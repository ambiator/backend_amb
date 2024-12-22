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

        mqttClient.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });

        mqttClient.on('close', () => {
            console.log('MQTT connection closed');
            mqttClient = null; // Reset client object
        });
    }
}

// Function to publish message
async function publishMessage(topic, message) {
    if (!mqttClient) {
        initializeMqttClient();
    }

    mqttClient.publish(topic, message, (error) => {
        if (error) {
            console.error('Error publishing message:', error);
        } else {
            console.log('Message published successfully');
        }
    });
}

// Main function to send a command and update device state
exports.checkFilterClean = async (req, res) => {
    const deviceId = req.body.deviceId;
    const commandTopic = `${deviceId}S`;
    const subscribeTopic = `${deviceId}P`;
    const message = JSON.stringify({"FILTER":1});

    let responseSent = false;

    initializeMqttClient();

    mqttClient.subscribe(subscribeTopic, (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
            return res.status(500).json({ success: false, message: 'Subscription error' });
        }
        console.log('Subscribed to topic:', subscribeTopic);

        publishMessage(commandTopic, message);

        // Handle timeout for response
        const timeout = setTimeout(() => {
            if (!responseSent) {
                console.log('No response received within 5 seconds. Handling as communication error.');
                responseSent = true;
                mqttClient.end();
                return res.status(500).json({ success: false, message: 'Communication error: No response received from the device.' });
            }
        }, 5000); // 5 seconds timeout

        mqttClient.on('message', async (topic, payload) => {
            if (responseSent) {
                console.log('Ignoring additional messages after response has been sent.');
                return;
            }

            try {
                const newState = JSON.parse(payload.toString());

                if (!newState.FC || (newState.FC !== 0 && newState.FC !== 1)) {
                    console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                    res.status(400).json({ success: false, message: 'Invalid payload' });
                    responseSent = true;
                    clearTimeout(timeout);
                    mqttClient.end();
                    return;
                }

                const result = await updateDeviceState(deviceId, newState.FC);

                const successMessage = newState.FC === 1 ? 'Check Filter.' : 'FILTER CLEAN IS OK.';
                const deviceStatus = newState.FC;

                res.status(200).json({ message: successMessage, deviceStatus });
                responseSent = true;
                clearTimeout(timeout);
                mqttClient.end();
            } catch (err) {
                console.error('An error occurred:', err);
                if (!responseSent) {
                    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                    responseSent = true;
                    clearTimeout(timeout);
                    mqttClient.end();
                }
            }
        });
    });
};
