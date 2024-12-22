const { connection, CustomError } = require('../config/dbSql2');
const cron = require('node-cron');
const moment = require('moment-timezone');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');
const winston = require('winston');

let mqttClient = null;

// Configure Winston
const logger = winston.createLogger({
    level: 'info', // Set log level
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console(), // Log to console
        new winston.transports.File({ filename: 'combined.log' }) // Log to file
    ]
});

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

exports.scheduleDeviceJobs = async () => {
    cron.schedule('0 * * * * *', async () => {
        try {
            const currentDate = new Date();
            const currentDay = currentDate.toLocaleString('en-us', { weekday: 'short' });
            const currentTime = currentDate.toLocaleTimeString('en-US', { hour12: false });


            const [rows] = await connection.execute(
                `SELECT * FROM deviceschedule WHERE useSchedulerState = 1 AND ${currentDay}Schedule = 1`
            );

            for (const row of rows) {
                const { deviceID } = row;
                const startTimeColumn = `${currentDay}StartTime`;
                const endTimeColumn = `${currentDay}EndTime`;

                // Extract the startTime and endTime from the database
                const startTimeString = row[startTimeColumn];
                const endTimeString = row[endTimeColumn];

                // Parse time strings using moment-timezone
                const startTime = moment(startTimeString, 'HH:mm');
                const endTime = moment(endTimeString, 'HH:mm');

                //only device state when 0 or of
                const [rowOff] = await connection.execute('SELECT * FROM devices WHERE deviceId = ? AND device_state = ?', [deviceID, 0]);

                if (rowOff.length > 0) {
                    const currentTimeAfterStartTime = moment().isAfter(startTime);
                    const currentTimeBeforeEndTime = moment().isBefore(endTime);

                    // Check if the current time has passed the startTime
                    if (currentTimeAfterStartTime && currentTimeBeforeEndTime) {


                        let responseSent = false;
                        // Initialize MQTT client before subscribing
                        initializeMqttClient();
                        mqttClient.subscribe(deviceID + 'P', (err) => {
                            if (err) {
                                console.error('Error subscribing to topic:', err);
                                return;
                            }
                            const startMessage = { "STATUS": 1 }
                            // Call the publishMessage function to publish the message
                            publishMessage(deviceID + 'S', JSON.stringify(startMessage));

                        });

                        // let responseSent = false;
                        mqttClient.on('message', async (topic, payload) => {
                            try {
                                const deviceIdWithoutSuffix = topic.slice(0, -1);
                                if (payload.toString() !== '1') {
                                    // console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                                    return; // Return here to prevent further execution
                                }
                                const newState = parseInt(payload.toString(), 10);
                                if (newState === 1) {
                                    const result = await updateDeviceState(deviceIdWithoutSuffix, newState);
                                } else {
                                    // Handle the case when payload is neither '1' nor '0'
                                    // console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                                }
                            } catch (err) {
                                // Handle errors here
                                res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                                responseSent = true;
                            }
                        });
                    }
                }

                //only device state when 0 or of
                const [rowOn] = await connection.execute('SELECT * FROM devices WHERE deviceId = ? AND device_state = ?', [deviceID, 1]);

                if (rowOn.length > 0) {
                    // Check if the current time has passed the endTime
                    if (moment().isAfter(endTime)) {
                        // Send command to start (replace this with your MQTT logic)

                        logger.info(`Sending $STOP command for device ${deviceID}`);
                        // Initialize MQTT client before subscribing
                        initializeMqttClient();

                        mqttClient.subscribe(deviceID + 'P', (err) => {
                            if (err) {
                                // console.error('Error subscribing to topic:', err);
                                logger.error('Error during scheduling:', err);

                                return;
                            }
                            // console.log('Subscribed to topic:', subscribeTopic);
                            const stopMessage = { "STATUS": 0 }
                            // Call the publishMessage function to publish the message
                            publishMessage(deviceID + 'S', JSON.stringify(stopMessage));
                        });

                        mqttClient.on('message', async (topic, payload) => {
                            try {
                                const deviceIdWithoutSuffix = topic.slice(0, -1);

                                /* if (payload.toString() !== '0' && payload.toString() !== '1') {
                                     return; // Return here to prevent further execution
                                 }*/

                                const newState = parseInt(payload.toString(), 10);

                                if (isNaN(newState) || (newState !== 0 && newState !== 1)) {

                                    return; // Return here to prevent further execution
                                }

                                const result = await updateDeviceState(deviceIdWithoutSuffix, newState);
                            } catch (err) {
                                // Handle errors here
                                logger.error('Error during message handling:', err);

                            }
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error during scheduling:', error);
        }
    });
}
