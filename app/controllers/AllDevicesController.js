const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');

let mqttClient = null;

// Function to initialize MQTT client
function initializeMqttClient() {
    if (!mqttClient) {
        const { host, port, username, password } = mqttConfig;
        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;

        mqttClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        // Event listeners for MQTT client
        mqttClient.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });

        mqttClient.on('close', () => {
            // console.log('MQTT connection closed');
            mqttClient = null; // Reset client object
        });

        mqttClient.on('reconnect', () => {
            // console.log('MQTT client reconnecting...');
        });

        mqttClient.on('offline', () => {
            // console.log('MQTT client is offline');
        });
    }
}

// Function to publish message
async function publishMessage(topic, message) {
    if (!mqttClient) {
        initializeMqttClient(); // Initialize MQTT client if not already initialized
    }

    mqttClient.publish(topic, message, (error) => {
        if (error) {
            console.error('Error publishing message:', error);
        } else {
            // console.log('Message published successfully');
        }
    });
}




// Function to update device state in the database
const updateDeviceState = async (deviceId, newState) => {
    try {
        const updateQuery = `UPDATE devices SET device_state = ? WHERE deviceId = ?`;
        const values = [newState, deviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return { success: true, message: "Successfully updated" };
        } else {
            throw new CustomError("Something went wrong!");
        }
    } catch (err) {
        throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
    }
};

// Main function to send a command and update device state
exports.AllDeviceCommand = async (req, res) => {
    try {

        const { host, port, username, password } = mqttConfig;
        // const host = 'hairdresser.cloudmqtt.com';
        // const port = '15520';
        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;

        const afiliateCode = req.headers.afiliatecode;
        const controlDevices = req.body.controlDevices; // 1 for START, 0 for STOP

        const [rows] = await connection.execute('SELECT deviceId FROM devices WHERE afiliateCode = ?', [afiliateCode]);

        // const deviceIdsPublish = rows.map(row => `${row.deviceId}S`);

        const newClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        newClient.on('connect', () => {
            // console.log('New client connected');

            const subscribePromises = rows.map((row) => {
                return new Promise((resolve) => {
                    const deviceId = row.deviceId;
                    const commandTopic = `${deviceId}S`;
                    const subscribeTopic = `${deviceId}P`;

                    newClient.subscribe(subscribeTopic, () => {
                        // console.log(`Subscribe to topic hi '${subscribeTopic}'`);
                        const startCommand = { "STATUS": 1 };
                        const stopCommand = { "STATUS": 0 };
                        const message = (controlDevices === '1') ? startCommand : stopCommand;
                        // console.log(`controlDevices '${controlDevices}'`);

                        newClient.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                            // console.log(`Publish to topic '${commandTopic}' with message '${message}'`);
                            if (error) {
                                console.error(error);
                            }
                            resolve();
                        });
                    });
                });
            });

            Promise.all(subscribePromises).then(() => {
                // console.log('All subscriptions and messages sent successfully');
                res.status(200).json({ message: 'Command sent successfully' });
            });

            newClient.on('message', async (topic, payload) => {
                try {
                    const deviceIdWithoutSuffix = topic.slice(0, -1);

                    if (payload.toString() !== '0' && payload.toString() !== '1') {
                        // console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                        res.status(400).json({ success: false, message: 'Invalid payload' });
                        responseSent = true;
                        return; // Return here to prevent further execution
                    }

                    const newState = parseInt(payload.toString(), 10);

                    const result = await updateDeviceState(deviceIdWithoutSuffix, newState);
                    // console.log(`Device state updated: ${JSON.stringify(result)}`);
                } catch (err) {
                    console.error(err);
                }
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'An error occurred' });
    }
};
