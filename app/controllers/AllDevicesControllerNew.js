const { connection, CustomError } = require('../config/dbSql2.js');
const sql = require('../config/dbSql.js');
require('dotenv').config();
const bcrypt = require('bcrypt');

const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');


const updateDeviceState = async (deviceId, newState, affiliateCode) => {
    try {
        // Check for undefined and set to null if necessary
        const cleanNewState = newState === undefined ? null : newState;
        const cleanAffiliateCode = affiliateCode === undefined ? null : affiliateCode;
        const cleanDeviceId = deviceId === undefined ? null : deviceId;

        // Ensure none of the parameters are undefined
        if (cleanAffiliateCode === null || cleanDeviceId === null) {
            throw new CustomError('Affiliate code or Device ID is missing.', 400);
        }

        const updateQuery = `UPDATE devices SET device_state = ? WHERE afiliateCode = ? AND deviceId = ?`;
        const values = [cleanNewState, cleanAffiliateCode, cleanDeviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return { success: true, message: "Successfully updated" };
        } else {
            throw new CustomError("Something went wrong while updating device state!");
        }
    } catch (err) {
        throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
    }
};

exports.AllDeviceCommand = async (req, res) => {
    let responseSent = false;
    try {

        const { controlDevices } = req.body;
        const affiliateCode = req.headers.afiliatecode;
        const { host, port, username, password } = mqttConfig;



        // console.log("controlDevices", controlDevices, "affiliateCode", affiliateCode)
        // Validate parameters
        if (controlDevices === undefined || affiliateCode === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: controlDevices or affiliateCode',
            });
        }

        // Fetch all device IDs for the affiliate
        const [rows] = await connection.execute('SELECT deviceId FROM devices WHERE afiliateCode = ?', [affiliateCode]);

        // Check if no devices are found for the given affiliate
        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No devices found for this affiliate.',
            });
        }

        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;
        const newClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        newClient.on('connect', async () => {
            // console.log('MQTT client connected');

            try {
                // Handle controlDevices
                if (controlDevices == 0) {
                    await handleStopDevices(newClient, rows, affiliateCode);
                    res.status(200).json({ success: true, message: 'Stop commands sent to all devices.' });
                } else {
                    await handleOnDevices(newClient, rows, affiliateCode);
                    res.status(200).json({ success: true, message: 'On commands sent to all devices.' });
                }
                responseSent = true; // Mark response as sent
            } catch (err) {
                console.error('Error during processing:', err);
                if (!responseSent) {
                    res.status(500).json({ success: false, message: err.message || 'An error occurred' });
                }
            }
        });

        newClient.on('error', (error) => {
            console.error('MQTT connection error:', error);
            if (!responseSent) {
                res.status(500).json({ success: false, message: 'MQTT connection error' });
            }
        });

        newClient.on('close', () => {
            // console.log('MQTT connection closed');
        });

    } catch (err) {
        if (!responseSent) {
            res.status(500).json({ success: false, message: err.message || 'An error occurred' });
        }
    }
};

// Handle stopping devices
const handleStopDevices = async (client, devices, affiliateCode) => {
    const stopCommand = { "STATUS": 0 }; // Command to stop the device

    for (const row of devices) {
        const deviceId = row.deviceId;
        const commandTopic = `${deviceId}S`;
        const subscribeTopic = `${deviceId}P`;

        await new Promise((resolve, reject) => {
            client.subscribe(subscribeTopic, (err) => {
                if (err) {
                    console.error(`Error subscribing to topic ${subscribeTopic}:`, err);
                    return reject(err);
                }

                // Publish the stop command to the command topic
                client.publish(commandTopic, JSON.stringify(stopCommand), { qos: 0, retain: false }, (error) => {
                    if (error) {
                        console.error(`Error publishing stop command to ${commandTopic}:`, error);
                        return reject(error);
                    } else {
                        // console.log(`Stop command published to ${commandTopic}`);
                    }
                });

                // Set a timeout for waiting for the device's response
                setTimeout(() => {
                    // console.log(`No response from device ${deviceId} within 5 seconds. Skipping.`);
                    resolve(); // Resolve even if no response
                }, 5000);
            });

            client.on('message', async (topic, payload) => {
                try {
                    const newState = parseInt(payload.toString(), 10);
                    if (newState === 0) {
                        const result = await updateDeviceState(deviceId, newState, affiliateCode);
                        // console.log(`Device state updated: ${result.message}`);
                    }
                } catch (err) {
                    console.error('Error processing MQTT message:', err);
                }
            });
        });
    }

    // Update blockFlag for affiliate to block
    await connection.execute(
        `UPDATE affiliate SET blockFlag = 1 WHERE afiliateCode = ?`,
        [affiliateCode]
    );

    // console.log('Stop commands sent to all devices.');
};


const handleOnDevices = async (client, devices, affiliateCode) => {
    const stopCommand = { "STATUS": 1 }; // Command to stop the device

    for (const row of devices) {
        const deviceId = row.deviceId;
        const commandTopic = `${deviceId}S`;
        const subscribeTopic = `${deviceId}P`;

        await new Promise((resolve, reject) => {
            client.subscribe(subscribeTopic, (err) => {
                if (err) {
                    console.error(`Error subscribing to topic ${subscribeTopic}:`, err);
                    return reject(err);
                }

                // Publish the stop command to the command topic
                client.publish(commandTopic, JSON.stringify(stopCommand), { qos: 0, retain: false }, (error) => {
                    if (error) {
                        console.error(`Error publishing stop command to ${commandTopic}:`, error);
                        return reject(error);
                    } else {
                        // console.log(`Stop command published to ${commandTopic}`);
                    }
                });

                // Set a timeout for waiting for the device's response
                setTimeout(() => {
                    // console.log(`No response from device ${deviceId} within 5 seconds. Skipping.`);
                    resolve(); // Resolve even if no response
                }, 5000);
            });

            client.on('message', async (topic, payload) => {
                try {
                    const newState = parseInt(payload.toString(), 10);
                    if (newState === 1) {
                        const result = await updateDeviceState(deviceId, newState, affiliateCode);
                        // console.log(`Device state updated: ${result.message}`);
                    }
                } catch (err) {
                    console.error('Error processing MQTT message:', err);
                }
            });
        });
    }

};

//above code
