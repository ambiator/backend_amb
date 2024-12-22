const { connection, CustomError } = require('../config/dbSql2');
const cron = require('node-cron');
const moment = require('moment-timezone');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');

let mqttClient = null;


// Function to initialize MQTT client
function initializeMqttClient() {
    if (!mqttClient) {
        // logger.info('Initializing MQTT client...');
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
            console.log('MQTT connection closed');
            mqttClient = null; // Reset client object
        });

        mqttClient.on('reconnect', () => {
            console.log('MQTT client reconnecting...');
        });

        mqttClient.on('offline', () => {
            console.log('MQTT client is offline');
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
            console.log('Message published successfully');
        }
    });
}

// Function to update device Self heal state in the database
const updateSelfHealState = async (deviceId, selfHealDeviceResponse) => {
    try {
        let updateQuery;
        let values;

        if (selfHealDeviceResponse === "SHOK") {
            updateQuery = `UPDATE devices SET selfHeal_ack = 1 WHERE deviceId = ?`;
        } else if (selfHealDeviceResponse === "SHONGPRC1") {
            updateQuery = `UPDATE devices SET shProcStatus = 1 WHERE deviceId = ?`;
        } else if (selfHealDeviceResponse === "SHONGPRC2") {
            updateQuery = `UPDATE devices SET shProcStatus = 2 WHERE deviceId = ?`;
        } else if (selfHealDeviceResponse === "SHONGPRC3") {
            updateQuery = `UPDATE devices SET shProcStatus = 3 WHERE deviceId = ?`;
        } else if (selfHealDeviceResponse === "SHCMP") {
            updateQuery = `UPDATE devices SET selfHeal_state = 1 WHERE deviceId = ?`;

            // Update the self_heal_schedule table when SHCMP response is received
            // const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const currentDate = moment().format('YYYY-MM-DD HH:mm:ss');
            const updateScheduleQuery = `UPDATE self_heal_schedule SET sh_status = 1, completedAt = ? WHERE deviceId = ?`;
            const updateScheduleValues = [currentDate, deviceId];
            await connection.execute(updateScheduleQuery, updateScheduleValues);
        } else {
            throw new CustomError("Invalid selfHealDeviceResponse");
        }

        values = [deviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return {
                success: true,
                message: "Successfully updated"
            };
        } else {
            throw new CustomError("Something went wrong!");
        }
    } catch (err) {
        throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
    }
};

exports.SelfHealScheduleCron = async () => {
    cron.schedule('0 * * * * *', async () => {
        // console.log('Entering Self heal schedule function...');
        try {

            // const scheduleData = await fetchSelfHealSchedule();

            const currentDate = new Date();
            const currentDay = currentDate.toLocaleString('en-us', { weekday: 'short' });
            const currentTime = currentDate.toLocaleTimeString('en-US', { hour12: false });

            // console.log(`Executing Self heal schedule at Time : ${currentTime} Date : ${currentDay}`); // Log execution time

            // Assuming you have a function to query the database
            const query = 'SELECT * FROM self_heal_schedule';
            const [rows] = await connection.execute(query);
            const { host, port, username, password } = mqttConfig;

            for (const row of rows) {
                const { deviceId, dayOfWeek, selfHealTime } = row;

                // Convert the selfHealTime from 'HH:mm:ss' format to 'HH:mm' for comparison
                const selfHealTimeWithoutSeconds = selfHealTime.substring(0, 5);

                // Check if the current day matches the day from the database
                if (moment().isoWeekday() === parseInt(dayOfWeek)) {
                    // Check if the current time matches the selfHealTime from the database
                    if (moment().format('HH:mm') === selfHealTimeWithoutSeconds) {

                        // Initialize MQTT client before subscribing
                        initializeMqttClient();

                        mqttClient.subscribe(deviceId + 'P', (err) => {
                            if (err) {
                                console.error('Error subscribing to topic:', err);
                                return;
                            }
                            const slefHealMessage = { "SH": 1 }
                            // Call the publishMessage function to publish the message
                            publishMessage(deviceId + 'S', JSON.stringify(slefHealMessage));

                        });

                        mqttClient.on('message', async (topic, payload) => {
                            try {
                                const deviceIdWithoutSuffix = topic.slice(0, -1);

                                if (payload.toString() !== 'SHOK' && payload.toString() !== 'SHONGPRC1' && payload.toString() !== 'SHONGPRC2' && payload.toString() !== 'SHONGPRC3' && payload.toString() !== 'SHCMP') {
                                    // console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                                    res.status(400).json({ success: false, message: 'Invalid payload' });
                                    responseSent = true;
                                    return; // Return here to prevent further execution
                                }

                                const selfHealDeviceResponse = (payload.toString());
                                const result = await updateSelfHealState(deviceIdWithoutSuffix, selfHealDeviceResponse);
                            } catch (err) {
                                // Handle errors here
                                res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                                responseSent = true;
                            }
                        });
                    }
                }
            }

        } catch (error) {
            console.error('Error during scheduling:', error);
        }
        // console.log('Exiting Self heal schedule function...');
    });
}
