const { connection, CustomError } = require('../config/dbSql2');
const cron = require('node-cron');
const moment = require('moment-timezone');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');


const updateSelfHealState = async (deviceId, newState) => {
    try {
        let updateQuery;
        let values;

        if (newState === "SHOK") {
            updateQuery = `UPDATE devices SET selfHeal_ack = 1 WHERE deviceId = ?`;
        } else if (newState === "SHONGPRC1") {
            updateQuery = `UPDATE devices SET shProcStatus = 1 WHERE deviceId = ?`;
        } else if (newState === "SHONGPRC2") {
            updateQuery = `UPDATE devices SET shProcStatus = 2 WHERE deviceId = ?`;
        } else if (newState === "SHONGPRC3") {
            updateQuery = `UPDATE devices SET shProcStatus = 3 WHERE deviceId = ?`;
        } else if (newState === "SHCMP") {
            updateQuery = `UPDATE devices SET selfHeal_state = 1 WHERE deviceId = ?`;
        } else {
            throw new CustomError("Invalid newState");
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

const sendSelfHealingCommand = (deviceID) => {
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
    // Implement logic to send MQTT command for self-healing
    console.log('Sending MQTT command for self-healing...');

    let commandSentSuccessfully = false;

    // Add your MQTT logic here
    client.on('connect', () => {
        console.log('Connected');

        // Disconnect the client before reconnecting
        client.end(() => {
            console.log('Client disconnected');

            // const { host, port, connectUrl, options } = mqttConfig;

            // const newClient = mqtt.connect(connectUrl, options);
            const newClient = mqtt.connect(connectUrl, {
                clientId,
                clean: true,
                connectTimeout: 4000,
                username,
                password,
                reconnectPeriod: 1000,
            });

            newClient.subscribe(deviceID + 'P', () => {
                console.log(`Subscribe to topic '${deviceID + 'P'}'`);
                const startMessage = { "SH": 1 }
                newClient.publish(deviceID + 'S', JSON.stringify(startMessage), { qos: 0, retain: false }, (error) => {
                    console.log(`Publish to topic '${deviceID + 'S'}'`);
                    if (error) {
                        console.error(error);
                    }
                });
            });

            newClient.on('message', async (topic, payload) => {
                try {

                    const deviceIdWithoutSuffix = topic.slice(0, -1);

                    // Check if payload is 'status' and ignore the message
                    // if (payload.toString() === 'STATUS') {
                    //     console.log(`Ignoring message with payload 'status' on topic '${topic}'`);
                    //     return;
                    // }

                    if (payload.toString() !== 'SHOK' && payload.toString() !== 'SHONGPRC1' && payload.toString() !== 'SHONGPRC2' && payload.toString() !== 'SHONGPRC3') {
                        console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                        res.status(400).json({ success: false, message: 'Invalid payload' });
                        responseSent = true;
                        return; // Return here to prevent further execution
                    }



                    const newState = (payload.toString());
                    const result = await updateSelfHealState(deviceIdWithoutSuffix, newState);

                    if (!commandSentSuccessfully) {
                        commandSentSuccessfully = true;

                        // Modify response based on newState
                        const successMessage = (newState === 1) ? 'Device turned on successfully.' : 'Device turned off successfully.';
                        res.status(200).json({ message: successMessage });
                    }

                } catch (err) {
                    // Handle errors here
                    if (!commandSentSuccessfully) {
                        commandSentSuccessfully = true;
                        res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                    }
                }
            });
        });
    });

};

// Function to fetch self-heal schedule from the database
const fetchSelfHealSchedule = async () => {
    try {
        // Assuming you have a function to query the database
        const query = 'SELECT * FROM self_heal_schedule';
        const [rows] = await connection.execute(query);


        return rows;
    } catch (error) {
        throw new CustomError('Error fetching self-heal schedule from the database', error);
    }
};

const updateCronJobs = async () => {
    try {
        const scheduleData = await fetchSelfHealSchedule();

        // Iterate through the schedule data and create cron expressions
        scheduleData.forEach((row) => {
            const selfHealTime = row.selfHealTime;  // Assuming selfHealTime is the first column
            const dayOfWeek = row.dayOfWeek;     // Assuming dayOfWeek is the second column
            const deviceId = row.deviceId;

            console.log('selfHealTime:', selfHealTime);
            console.log('dayOfWeek:', dayOfWeek);
            console.log('deviceId:', deviceId);
            console.log('number dat:', moment().isoWeekday());
            // Parse selfHealTime into a moment object
            const selfHealMoment = moment(selfHealTime, 'HH:mm:ss');


            // Check if the current moment is after the specified time on the specified day
            if (moment().isAfter(selfHealMoment) && moment().isoWeekday() === dayOfWeek) {
                sendSelfHealingCommand(deviceId);
            }


        });
    } catch (error) {
        console.error('Error updating cron jobs:', error);
    }
};
// Schedule the updateCronJobs function to run every minute (adjust the cron expression as needed)

exports.SelfHealScheduleCron = async () => {
    cron.schedule('* * * * *', () => {
        updateCronJobs();
    });
}