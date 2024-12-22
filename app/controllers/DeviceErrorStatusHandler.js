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
    // console.log('Connected to MQTT broker');
    // Subscribe to topics on connection
    subscribeToTopics();
});

client.on('error', (error) => {
    console.error('MQTT connection error:', error);
});

const deviceStatusKeys = ["FAN", "PMP", "WTR", "PFF", "FP", "FC", "WS", "COM", "HUM"];
// {"FAN":0,"PMP":0,"WTR":0,"PFF":0,"FP":0,"FC":1,"WS":0,"COM":0,"HUM":0}

client.on('message', async (topic, payload) => {

    const payloadString = payload.toString();
    const isExpectedFormat = /^{"FAN":\d+,"PMP":\d+,"WTR":\d+,"PFF":\d+,"FP":\d+,"FC":\d+,"WS":\d+,"COM":\d+,"HUM":\d+}$/.test(payloadString);

    if (isExpectedFormat) {
        try {
            const parsedPayload = JSON.parse(payload.toString());
            const isDeviceStatusMessage = deviceStatusKeys.every(key => key in parsedPayload);

            if (subscribedTopics.has(topic) && isDeviceStatusMessage) {
                handleDeviceStatusMessage(topic, payload);
            } else {
                // console.log(`Ignoring message for topic '${topic}' with payload '${payload.toString()}'`);
            }
        } catch (error) {
            console.error(`Error parsing JSON for topic '${topic}': ${error.message}`);
            // console.log(`Ignoring message for topic '${topic}' with payload '${payloadString}'`);
        }
    } else {
        // console.log(`Ignoring message for topic '${topic}'. Payload does not match the expected format.`);
    }
});

async function handleDeviceStatusMessage(topic, payload) {
    const deviceId = topic.slice(0, -1);
    try {
        const deviceStatus = JSON.parse(payload.toString());

        const fan = deviceStatus.FAN;
        const pump = deviceStatus.PMP;
        const water = deviceStatus.WTR;
        // const water = null;
        const filterPresent = deviceStatus.FP;
        const filterClean = deviceStatus.FC;
        const waterSupply = deviceStatus.WS;
        const comm = deviceStatus.COM;
        const PFF = deviceStatus.PFF;
        const HUM = deviceStatus.HUM;

        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');

        const insertQuery = `
            INSERT INTO devicestatus (deviceId, fan, pump, water, filterPresent, filterClean, waterSupply, comm, PFF, HUM, dateTime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await connection.execute(insertQuery, [deviceId, fan, pump, water, filterPresent, filterClean, waterSupply, comm, PFF, HUM, dateTime])
            .catch(error => {
                console.error('Error executing database query:', error);
            });

        // Update isActive state in device_data table
        const updateIsActiveQuery = `
         UPDATE devices
         SET isActive = 1
         WHERE deviceId = ?
     `;
        await connection.execute(updateIsActiveQuery, [deviceId]);


        // console.log(`Inserted into devicestatus table. Rows affected: ${result.affectedRows}`);
    } catch (error) {
        // console.error('Error processing device status message:', error);
    }
}
