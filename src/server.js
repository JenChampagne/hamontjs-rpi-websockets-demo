// basic websocket library module
const WebSocket = require('ws');

// subprocess library module used for running shell commands
const child_process = require('child_process');
const execute = (cmd, callback) => {
    console.log('Running:', cmd);
    return child_process.exec(cmd, callback);
};

// general config parameters object to keep changable details in one place
const config = {
    port: 8080,
    pins: {
        red: 21,
        yellow: 20,
        green: 16,
    },
    util: {
        mode: 'gpio -g mode',
        read: 'gpio -g read',
        write: 'gpio -g write',
    },
};

// the full shell commands in an object again to keep all in one place in case it needs to change
const gpioConfig = {
    // methods which initialise pins as output signals
    init: {
        red: (callback) => execute(`${config.util.mode} ${config.pins.red} out`, callback),
        yellow: (callback) => execute(`${config.util.mode} ${config.pins.yellow} out`, callback),
        green: (callback) => execute(`${config.util.mode} ${config.pins.green} out`, callback),
    },
    // methods which retrieve the current value of the output pins
    get: {
        red: (callback) => execute(`${config.util.read} ${config.pins.red}`, callback),
        yellow: (callback) => execute(`${config.util.read} ${config.pins.yellow}`, callback),
        green: (callback) => execute(`${config.util.read} ${config.pins.green}`, callback),
    },
    // methods which change the value of the output pins
    set: {
        red: (callback) => (value) => execute(`${config.util.write} ${config.pins.red} ${value == true? '1': '0'}`, callback),
        yellow: (callback) => (value) => execute(`${config.util.write} ${config.pins.yellow} ${value == true? '1': '0'}`, callback),
        green: (callback) => (value) => execute(`${config.util.write} ${config.pins.green} ${value == true? '1': '0'}`, callback),
    },
};

// state object which is used to store the current value of a light / output pin
// used for the `get` set of methods as a way to get the shell command results without more promises
const gpioState = {
    red: false,
    yellow: false,
    green: false,
};

// method to initialise an output pin
const gpioInit = (colour) => {
    const callback = (error, stdout) => {
        if (error) {
            console.log(`Error initializing GPIO ${colour}: ${error}`);
        }
        else {
            console.log(`Successfully initialized GPIO ${colour}`);
        }
    };
    // this calls the correct colour method from the gpioConfig init methods object
    return gpioConfig.init[ colour.toLowerCase() ]( callback );
};

const gpioGet = (colour) => {
    const callback = (error, stdout) => {
        if (error) {
            console.log(`Error getting GPIO ${colour}: ${error}`);
        }
        else {
            console.log(`Successfully got GPIO ${colour}`);
            console.log(`Setting stored state of ${colour} to '${stdout}'`);
            gpioState[colour.toLowerCase()] = stdout.search(/1/) >= 0;
        }
    };
    return gpioConfig.get[ colour.toLowerCase() ]( callback );
};

const gpioSet = (colour) => (value) => {
    const callback = (error, stdout) => {
        if (error) {
            console.log(`Error setting GPIO ${colour}: ${error}`);
        }
        else {
            console.log(`Successfully set GPIO ${colour}`);
        }
    };
    return gpioConfig.set[ colour.toLowerCase() ]( callback )( value );
};

// this type of Pomise syntax will immediately call the first function (the console log)
// and once completed, will return and begin the first `.then`, and so on, until each `.then`
// has been executed one after the other
const initGPIOs = () => Promise.resolve()
    .then(() => console.log('Initializing GPIO Pins.'))
    .then(() => gpioInit( 'red' ))
    .then(() => gpioSet( 'red' )( false ))
    .then(() => gpioInit( 'yellow' ))
    .then(() => gpioSet( 'yellow' )( false ))
    .then(() => gpioInit( 'green' ))
    .then(() => gpioSet( 'green' )( false ))
;

const initServer = () => {
    // create the server to listen on the configured port
    const server = new WebSocket.Server({ port: config.port });

    // helper function to broadcast a message to every connected client
    // some WebSocket libraries include this
    const broadcast = (message) => {
        const totalClients = server.clients.size;
        console.log(`Broadcasting to all ${totalClients} client(s):\n`, message);

        server.clients.forEach((client) => {
            client.send(JSON.stringify(message));
        });
    };

    server.on('listening', () => {
        console.log(`Listening on`, server.address());
    });

    server.on('error', (message) => {
        console.log(`Error received: ${message}`);
    });

    server.on('close', () => {
        console.log(`Closing server.`);
    });

    // client connected event
    server.on('connection', (client, request) => {
        const clientIP = request.connection.remoteAddress;
        // this helper function is used to both log and send responses
        const respond = (message) => {
            console.log(`Sending to client:\n`, message);

            client.send(JSON.stringify(message));
        };

        client.on('open', (message) => {
            console.log(`Client connected from ${clientIP}`);

            const response = {message: 'Welcome!'};
            respond(response);
        });

        client.on('close', (message) => {
            console.log(`Client disconnected from ${clientIP}`);

            const response = {message: 'Goodbye!'};
            respond(response);
        });

        client.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            }
            catch (errors) {
                const response = {message: 'Only JSON is currently supported.'};
                respond(response);
                return; // prevent further parsing below
            }

            // regular expression matching the received data
            // most definitely overkill for this task
            // but code is art, and this art speaks to my love of regex in the moment
            if (data.action.search(/^get$/i) >= 0) {
                if (data.target.search(/^red$/i) >= 0) {
                    gpioGet('red');
                }
                else if (data.target.search(/^yellow$/i) >= 0) {
                    gpioGet('yellow');
                }
                else if (data.target.search(/^green$/i) >= 0) {
                    gpioGet('green');
                }
                else {
                    const response = {
                        message: `Error, unknown target given. Target should be 'red', 'yellow', or 'green'.`,
                        received: data,
                    };
                    respond(response);
                    return; // prevent the broadcast below from happening
                }

                // give the hardware some time to process, then broadcast the state to all clients
                setTimeout(() => {
                    const status = gpioState[data.target.toLowerCase()]?
                        'ON':
                        'OFF'
                    ;
                    const response = {
                        message: `Current status of ${data.target} light is ${status}.`,
                        received: data,
                    };
                    broadcast(response);
                }, 150);
            }
            else if (data.action.search(/^set$/i) >= 0) {
                if (data.target.search(/^red$/i) >= 0) {
                    gpioSet('red')(data.value);
                }
                else if (data.target.search(/^yellow$/i) >= 0) {
                    gpioSet('yellow')(data.value);
                }
                else if (data.target.search(/^green$/i) >= 0) {
                    gpioSet('green')(data.value);
                }
                else {
                    const response = {
                        message: `Error, unknown target given. Target should be 'red', 'yellow', or 'green'.`,
                        received: data,
                    };
                    respond(response);
                    return; // prevent the broadcast below from happening
                }

                const status = data.value == true?
                    'ON':
                    'OFF'
                ;
                const response = {
                    message: `Successfully set ${data.target} light to ${status}.`,
                    received: data,
                };
                broadcast(response);
            }
            else if (data.action.search(/^echo$/i) >= 0) {
                const response = {
                    message: `ECHO Echo echo ....`,
                    received: data,
                };
                respond(response);
            }
            else {
                const response = {
                    message: `Sorry. Unknown action given.`,
                    received: data,
                };
                respond(response);
            }
        });
    });
};

// function which initialises GPIOs and launches the WebSocket server
const begin = () => Promise.resolve()
    .then(() => console.log('Beginning server start-up.'))
    .then(() => initGPIOs())
    .then(() => initServer())
;

// execute the above function
begin();
