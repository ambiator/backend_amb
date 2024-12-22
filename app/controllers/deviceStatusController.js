const { connection } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');

const { host, port, username, password } = mqttConfig;

const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${host}:${port}`;

const subscribedTopics = new Set();

const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username,
    password,
    reconnectPeriod: 1000,
});

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    subscribeToTopics();
});

client.on('error', (error) => {
    console.error('MQTT connection error:', error);
});

async function subscribeToTopics() {
    try {
        const [rows] = await connection.execute('SELECT deviceId FROM devices', []);
        const deviceIdsFromDatabase = rows.map(row => `${row.deviceId}P`);

        deviceIdsFromDatabase.forEach(deviceId => {
            client.subscribe(deviceId, (err) => {
                if (err) {
                    console.error(`Error subscribing to topic '${deviceId}':`, err);
                } else {
                    // console.log(`Subscribed to topic '${deviceId}'`);
                    subscribedTopics.add(deviceId);
                }
            });
        });
    } catch (error) {
        console.error('Error querying device IDs from the database:', error);
    }
}

client.on('message', async (topic, payload) => {
    if (subscribedTopics.has(topic) && payload.toString() === 'STATUS') {
        // console.log(`Processing 'status' message for topic '${topic}', '${payload.toString()}'`);
        const deviceId = topic.slice(0, -1);

        try {
            const [rows] = await connection.execute('SELECT deviceId, device_state FROM devices WHERE deviceId = ?', [deviceId]);

            if (rows.length > 0) {
                const { device_state } = rows[0];
                const message = { "STATUS": (device_state == 1) ? 1 : 0 };

                client.publish(deviceId + 'S', JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                    if (error) {
                        console.error(`Error publishing to topic '${deviceId + 'S'}':`, error);
                    }
                });
            } else {
                // console.log(`Device with ID '${deviceId}' not found in the database.`);
            }
        } catch (error) {
            console.error('Error querying device state from the database:', error);
        }
    } else {
        // console.log(`Ignoring message for topic '${topic}' with payload '${payload.toString()}'`);
    }
});

module.exports = client;
