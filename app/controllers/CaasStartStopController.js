
const { connection, CustomError } = require('../config/dbSql2');
const sql = require('../config/dbSql');
require('dotenv').config();
const bcrypt = require('bcrypt');

const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');


/*
// Function to update device state in the database
const updateDeviceState = async (deviceId, newState, affiliateCode) => {
    try {
        const updateQuery = `UPDATE devices SET device_state = ? WHERE afiliateCode = ?`;
        const values = [newState, affiliateCode];
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
*/
/*
exports.CaasControl = async (req, res) => {
    try {

        console.log("Tiger aster")

        const { statusFlag } = req.body;
        const affiliateCode = req.headers.afiliatecode;

        const { host, port, username, password } = mqttConfig;

        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;

        const [rows] = await connection.execute('SELECT deviceId FROM devices WHERE afiliateCode = ?', [affiliateCode]);

        // const deviceIdsPublish = rows.map(row => `${row.deviceId}S`);

        const newClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        // Check if both parameters are defined
        if (statusFlag === undefined || affiliateCode === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: statusFlag or affiliateCode'
            });
        }

        newClient.on('connect', () => {
            console.log('New client connected');

            const subscribePromises = rows.map((row) => {
                return new Promise((resolve) => {
                    const deviceId = row.deviceId;
                    const commandTopic = `${deviceId}S`;
                    const subscribeTopic = `${deviceId}P`;

                    newClient.subscribe(subscribeTopic, () => {
                        console.log(`Subscribe to topic hi '${subscribeTopic}'`);
                        const startCommand = { "STATUS": 1 };
                        const stopCommand = { "STATUS": 0 };
                        const message = (statusFlag === 1) ? stopCommand : 'not start cammand send only affiliate update only 0';
                        console.log(`statusFlag '${statusFlag}'`);

                        newClient.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                            console.log(`Publish to topic '${commandTopic}' with message '${message}'`);
                            if (error) {
                                console.error(error);
                            }
                            resolve();
                        });
                    });
                });
            });

            Promise.all(subscribePromises).then(() => {
                console.log('All subscriptions and messages sent successfully');
                res.status(200).json({ message: 'Command sent successfully' });
            });

            newClient.on('message', async (topic, payload) => {
                try {
                    const deviceIdWithoutSuffix = topic.slice(0, -1);

                    if (payload.toString() !== '0') {
                        console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                        res.status(400).json({ success: false, message: 'Invalid payload' });
                        responseSent = true;
                        return; // Return here to prevent further execution
                    }

                    const newState = parseInt(payload.toString(), 10);

                    const result = await updateDeviceState(deviceIdWithoutSuffix, newState, affiliateCode);
                    console.log(`Device state updated: ${JSON.stringify(result)}`);
                } catch (err) {
                    console.error(err);
                }
            });
        });

        // Execute the query to update the affiliate's status
        const result = await connection.execute(`
            UPDATE affiliate 
            SET blockFlag = ? WHERE afiliateCode = ? 
        `, [statusFlag, affiliateCode]);

        // Determine the response message based on the statusFlag value
        const action = statusFlag === 1 ? 'blocked' : 'unblocked';
        return res.status(200).json({
            success: true,
            message: `Affiliate successfully ${action}`
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'An error occurred' });
    }
};
*/

/*
exports.CaasControl = async (req, res) => {
    try {
        console.log("Tiger aster");

        const { statusFlag } = req.body;
        const affiliateCode = req.headers.afiliatecode;

        const { host, port, username, password } = mqttConfig;

        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;

        const [rows] = await connection.execute('SELECT deviceId FROM devices WHERE afiliateCode = ?', [affiliateCode]);

        const newClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        // Check if both parameters are defined
        if (statusFlag === undefined || affiliateCode === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: statusFlag or affiliateCode',
            });
        }

        let responseSent = false;  // Track if the response is already sent

        newClient.on('connect', () => {
            console.log('New client connected');

            if (statusFlag === 1) {
                // Stop all machines by sending the stop command
                const subscribePromises = rows.map((row) => {
                    return new Promise((resolve) => {
                        const deviceId = row.deviceId;
                        const commandTopic = `${deviceId}S`;
                        const subscribeTopic = `${deviceId}P`;

                        newClient.subscribe(subscribeTopic, () => {
                            console.log(`Subscribed to topic '${subscribeTopic}'`);
                            const stopCommand = { "STATUS": 0 };  // Stop command
                            console.log(`Sending stop command due to statusFlag '${statusFlag}'`);

                            newClient.publish(commandTopic, JSON.stringify(stopCommand), { qos: 0, retain: false }, (error) => {
                                console.log(`Published stop command to topic '${commandTopic}'`);
                                if (error) {
                                    console.error(error);
                                }
                                resolve();
                            });
                        });
                    });
                });

                Promise.all(subscribePromises).then(() => {
                    console.log('All stop commands sent successfully');

                    if (!responseSent) {
                        responseSent = true;
                        res.status(200).json({ message: 'Stop command sent successfully' });
                    }
                }).catch((err) => {
                    console.error('Error in Promise.all:', err);
                    if (!responseSent) {
                        responseSent = true;
                        res.status(500).json({ success: false, message: 'Error sending stop commands' });
                    }
                });
            } else {
                // statusFlag = 0: Do not send any MQTT command, only update the blockFlag
                if (!responseSent) {
                    responseSent = true;
                    res.status(200).json({ message: 'No start command sent, only updated blockFlag' });
                }
            }

            newClient.on('message', async (topic, payload) => {
                try {

                    console.log("new client mqtt messahe")
                    const deviceIdWithoutSuffix = topic.slice(0, -1);
                    const newState = parseInt(payload.toString(), 10);

                    const result = await updateDeviceState(deviceIdWithoutSuffix, newState, affiliateCode);
                    console.log(`Device state updated: ${JSON.stringify(result)}`);
                } catch (err) {
                    console.error('Error in message handler:', err);
                }
            });
        });

        // Update affiliate's blockFlag based on statusFlag
        await connection.execute(`
            UPDATE affiliate 
            SET blockFlag = ? 
            WHERE afiliateCode = ?
        `, [statusFlag, affiliateCode]);

        const action = statusFlag === 1 ? 'blocked' : 'unblocked';
        if (!responseSent) {
            responseSent = true;
            return res.status(200).json({
                success: true,
                message: `Affiliate successfully ${action}`,
            });
        }

    } catch (err) {
        if (!responseSent) {
            return res.status(500).json({ success: false, message: err.message || 'An error occurred' });
        }
    }
};
*/

/*
const updateDeviceState = async (deviceId, newState, affiliateCode) => {
    try {
        const updateQuery = `UPDATE devices SET device_state = ? WHERE afiliateCode = ? AND deviceId = ?`;
        const values = [newState, affiliateCode, deviceId];
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

exports.CaasControl = async (req, res) => {
    let responseSent = false;
    try {
        const { statusFlag } = req.body;
        const affiliateCode = req.headers.affiliatecode;
        const { host, port, username, password } = mqttConfig;

        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;


        // Fetch all device IDs for the affiliate
        const [rows] = await connection.execute('SELECT deviceId FROM devices WHERE afiliateCode = ?', [affiliateCode]);


        // Check if no devices are found for the given affiliate
        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No devices found for this affiliate.',
            });
        }
        // Validate parameters
        if (statusFlag === undefined || affiliateCode === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: statusFlag or affiliateCode',
            });
        }

        const newClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        newClient.on('connect', () => {
            console.log('MQTT client connected');

            if (statusFlag === 1) {
                // Stop all devices by sending the stop command
                rows.forEach((row) => {
                    const deviceId = row.deviceId;
                    const commandTopic = `${deviceId}S`;
                    const subscribeTopic = `${deviceId}P`;
                    const stopCommand = { "STATUS": 0 }; // Command to stop the device

                    newClient.subscribe(subscribeTopic, (err) => {
                        if (err) {
                            console.error(`Error subscribing to topic ${subscribeTopic}:`, err);
                            return;
                        }
                        // console.log(`Subscribed to topic ${subscribeTopic}`);

                        // Publish the stop command to the command topic
                        newClient.publish(commandTopic, JSON.stringify(stopCommand), { qos: 0, retain: false }, (error) => {
                            if (error) {
                                console.error(`Error publishing stop command to ${commandTopic}:`, error);
                            } else {
                                console.log(`Stop command published to ${commandTopic}`);
                            }
                        });

                        // Set a timeout for waiting for the device's response
                        setTimeout(() => {
                            if (!responseSent) {
                                console.log(`No response from device ${deviceId} within 5 seconds. Skipping.`);
                                responseSent = true; // Indicate that a response was handled
                                // Proceed to next iteration for other devices
                            }
                        }, 5000); // 5-second timeout for individual device response
                    });
                });
            } else {
                // If statusFlag is 0, don't send commands, just update the blockFlag
                res.status(200).json({ message: 'No start command sent, only updated blockFlag' });
                responseSent = true;
            }

            // Update blockFlag for affiliate
            connection.execute(
                `UPDATE affiliate SET blockFlag = ? WHERE afiliateCode = ?`,
                [statusFlag, affiliateCode]
            );

            newClient.on('message', async (topic, payload) => {
                try {
                    const deviceIdWithoutSuffix = topic.slice(0, -1);
                    const newState = parseInt(payload.toString(), 10);

                    if (isNaN(newState)) {
                        console.log(`Invalid payload received from topic ${topic}: ${payload.toString()}`);
                        return; // Ignore invalid messages
                    }

                    const result = await updateDeviceState(deviceIdWithoutSuffix, newState, affiliateCode);
                    console.log(`Device state updated: ${result.message}`);
                } catch (err) {
                    console.error('Error processing MQTT message:', err);
                }
            });

            if (!responseSent) {
                responseSent = true;
                res.status(200).json({ message: 'Stop commands sent to all devices' });
            }
        });

        newClient.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });

        newClient.on('close', () => {
            console.log('MQTT connection closed');
        });

    } catch (err) {
        if (!responseSent) {
            res.status(500).json({ success: false, message: err || 'An error occurred' });
        }
    }
};
*/

/*
const updateDeviceState = async (deviceId, newState, affiliateCode) => {
    try {
        const updateQuery = `UPDATE devices SET device_state = ? WHERE afiliateCode = ? AND deviceId = ?`;
        const values = [newState, affiliateCode, deviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return { success: true, message: "Successfully updated" };
        } else {
            throw new CustomError("Something went wrong while updating device state!");
        }
    } catch (err) {
        throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
    }
};*/

/*
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


exports.CaasControl = async (req, res) => {
    let responseSent = false;
    try {
        const { statusFlag } = req.body;
        const affiliateCode = req.headers.affiliatecode;
        const { host, port, username, password } = mqttConfig;

        const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
        const connectUrl = `mqtt://${host}:${port}`;

        // Fetch all device IDs for the affiliate
        const [rows] = await connection.execute('SELECT deviceId FROM devices WHERE afiliateCode = ?', [affiliateCode]);

        // Check if no devices are found for the given affiliate
        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No devices found for this affiliate.',
            });
        }

        // Validate parameters
        if (statusFlag === undefined || affiliateCode === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: statusFlag or affiliateCode',
            });
        }

        const newClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            username,
            password,
            reconnectPeriod: 1000,
        });

        newClient.on('connect', () => {
            console.log('MQTT client connected');

            if (statusFlag === 1) {
                // Stop all devices by sending the stop command
                rows.forEach((row) => {
                    const deviceId = row.deviceId;
                    const commandTopic = `${deviceId}S`;
                    const subscribeTopic = `${deviceId}P`;
                    const stopCommand = { "STATUS": 0 }; // Command to stop the device

                    newClient.subscribe(subscribeTopic, (err) => {
                        if (err) {
                            console.error(`Error subscribing to topic ${subscribeTopic}:`, err);
                            return;
                        }
                        // console.log(`Subscribed to topic ${subscribeTopic}`);

                        // Publish the stop command to the command topic
                        newClient.publish(commandTopic, JSON.stringify(stopCommand), { qos: 0, retain: false }, (error) => {
                            if (error) {
                                console.error(`Error publishing stop command to ${commandTopic}:`, error);
                            } else {
                                console.log(`Stop command published to ${commandTopic}`);
                            }
                        });

                        // Set a timeout for waiting for the device's response
                        setTimeout(() => {
                            if (!responseSent) {
                                console.log(`No response from device ${deviceId} within 5 seconds. Skipping.`);
                                responseSent = true; // Indicate that a response was handled
                                // Proceed to next iteration for other devices
                            }
                        }, 5000); // 5-second timeout for individual device response
                    });


                    newClient.on('message', async (topic, payload) => {
                        try {
                            const deviceIdWithoutSuffix = topic.slice(0, -1);
                            const newState = parseInt(payload.toString(), 10);

                            if (isNaN(newState)) {
                                console.log(`Invalid payload received from topic ${topic}: ${payload.toString()}`);
                                return; // Ignore invalid messages
                            }

                            const result = await updateDeviceState(deviceId, newState, affiliateCode);
                            console.log(`Device state updated: ${result.message}`);
                        } catch (err) {
                            console.error('Error processing MQTT message:', err);
                        }
                    });
                });
            } else {
                // If statusFlag is 0, don't send commands, just update the blockFlag
                res.status(200).json({ message: 'No start command sent, only updated blockFlag' });
                responseSent = true;
            }

            // Update blockFlag for affiliate
            connection.execute(
                `UPDATE affiliate SET blockFlag = ? WHERE afiliateCode = ?`,
                [statusFlag, affiliateCode]
            );



            if (!responseSent) {
                responseSent = true;
                res.status(200).json({ message: 'Stop commands sent to all devices' });
            }
        });

        newClient.on('error', (error) => {
            console.error('MQTT connection error:', error);
        });

        newClient.on('close', () => {
            console.log('MQTT connection closed');
        });

    } catch (err) {
        if (!responseSent) {
            res.status(500).json({ success: false, message: err || 'An error occurred' });
        }
    }
};
*/
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

exports.CaasControl = async (req, res) => {
    let responseSent = false;
    try {

        const { statusFlag } = req.body;
        const affiliateCode = req.headers.afiliatecode;
        const { host, port, username, password } = mqttConfig;
        // console.log("statusFlag", statusFlag, "affiliateCode", affiliateCode)
        // Validate parameters
        if (statusFlag === undefined || affiliateCode === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: statusFlag or affiliateCode',
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
                // Handle statusFlag
                if (statusFlag === 1) {
                    await handleStopDevices(newClient, rows, affiliateCode);
                    await updateBlockFlag(affiliateCode, 1); // Block the affiliate
                    res.status(200).json({ success: true, message: 'Stop commands sent to all devices and affiliate blocked successfully.' });
                } else {
                    await updateBlockFlag(affiliateCode, 0); // Unblock the affiliate
                    res.status(200).json({ success: true, message: 'Affiliate unblocked successfully' });
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

// Unblock affiliate
const updateBlockFlag = async (affiliateCode, blockFlag) => {
    await connection.execute(
        `UPDATE affiliate SET blockFlag = ? WHERE afiliateCode = ?`,
        [blockFlag, affiliateCode]
    );
};


exports.checkPassword = (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const query = 'SELECT * FROM users WHERE afiliateCode = ? AND userRole = ?';
        sql.query(query, ['AMBIAFCODE', 'ambiator'], function (err, result) {
            if (err) return res.status(400).json({ success: false, message: err.message });

            if (result.length > 0) {
                // Create an array of promises for each bcrypt comparison
                const passwordChecks = result.map(user => {
                    return new Promise((resolve, reject) => {
                        bcrypt.compare(password, user.password, function (bcryptErr, bcryptResult) {
                            if (bcryptErr) {
                                reject(bcryptErr);  // Reject if bcrypt throws an error
                            } else if (bcryptResult) {
                                resolve(true);  // Resolve true if password matches
                            } else {
                                resolve(false); // Resolve false if password doesn't match
                            }
                        });
                    });
                });

                // Use Promise.all to wait for all comparisons to complete
                Promise.all(passwordChecks)
                    .then(results => {
                        if (results.includes(true)) {
                            // If any password match is found, return success
                            return res.status(200).json({
                                success: true,
                                message: "Caas Ambiator Success",
                            });
                        } else {
                            // If no match is found, return invalid password
                            return res.status(400).json({ success: false, message: "Invalid password!" });
                        }
                    })
                    .catch(error => {
                        // Handle any bcrypt errors
                        return res.status(400).json({ success: false, message: error.message });
                    });
            } else {
                return res.status(400).json({ success: false, message: "Email is not valid!" });
            }
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'An error occurred' });
    }
};


