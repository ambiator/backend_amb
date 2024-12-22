const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');

const moment = require('moment-timezone');

// const host = 'hairdresser.cloudmqtt.com';
// const port = '15520';

const { host, port, username, password } = mqttConfig;


const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${host}:${port}`;

const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username,
    password,
    reconnectPeriod: 1000,
});

const subscribedTopics = new Set();

const subscribeToTopics = async () => {
    try {
        // Query device IDs from the database
        const [rows] = await connection.execute('SELECT deviceId FROM devices', []);

        // Extract device IDs from the rows
        const deviceIdsFromDatabase = rows.map(row => `${row.deviceId}P`);

        // Subscribe to each device's topic
        deviceIdsFromDatabase.forEach(deviceId => {
            // const topic = `${deviceId}S`;
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
};

client.on('connect', () => {
    // console.log('Connected');
    // Call the async function to subscribe to topics
    subscribeToTopics();
});

const temperatureKeys = ["OT", "OH", "SL", "SP"];

client.on('message', async (topic, payload) => {
    const payloadString = payload.toString();


    // Check if payload matches the expected format
    // const isExpectedFormat = /^{"OT":\d+,"OH":\d+,"SL":\d+,"SP":\d+}$/.test(payloadString);
    const isExpectedFormat = /^{"OT":\d+\.\d+,"OH":\d+\.\d+,"SL":\d+\.\d+,"SP":\d+\.\d+}$/.test(payloadString);



    if (isExpectedFormat) {
        try {
            const parsedPayload = JSON.parse(payload.toString());

            // Check if parsedPayload has all required keys
            const isTemperatureMessage = temperatureKeys.every(key => key in parsedPayload);

            if (subscribedTopics.has(topic) && isTemperatureMessage) {
                handleTemperatureMessage(topic, payload);
            } else {
                // console.log(`Ignoring message for topic '${topic}' with payload '${payloadString}'`);
            }
        } catch (error) {
            console.error(`Error parsing JSON for topic '${topic}': ${error.message}`);
            // console.log(`Ignoring message for topic '${topic}' with payload '${payloadString}'`);
        }
    } else {
        // console.log(`Ignoring message for topic '${topic}'. Payload does not match the expected format.with payload '${payloadString}'`);
    }
});

async function handleTemperatureMessage(topic, payload) {
    const deviceId = topic.slice(0, -1);
    // console.log("deviceId deviceId" + deviceId);

    try {
        const tmpMessage = JSON.parse(payload.toString());

        const outTemp = tmpMessage.OT;
        const outHum = tmpMessage.OH;
        const supply = tmpMessage.SL;
        const setPoint = tmpMessage.SP;

        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');

        const insertQuery = `
            INSERT INTO temperature (deviceId, outTemp, outHum, supply, setPoint, dateTime)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await connection.execute(insertQuery, [deviceId, outTemp, outHum, supply, setPoint, dateTime])
            .catch(error => {
                console.error('Error executing database query:', error);
            });

        // console.log(`Inserted into temperature table. Rows affected: ${result.affectedRows}`);
    } catch (error) {
        console.error('Error processing temperature message:', error);
    }
}

