const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');

const { ModeSendCommand, SetPointCommand } = require('../utility/DeviceStatus.js');
const { fanRangeSet } = require('../utility/utilityFunction.js');



exports.setFanSpeed = async (req, res) => {
    try {
        const fanSpeedDetails = req.body;
        // const afiliateCode = req.headers.afiliatecode;

        const deviceId = fanSpeedDetails.deviceId;
        const mode = fanSpeedDetails.MODE;

        const [fRows] = await connection.execute(`SELECT * FROM devices WHERE deviceId = ?`, [deviceId]);

        if (fRows.length === 0) {
            throw new CustomError("Device not found!", 404);
        }

        const installerOverrideModeState = fRows[0].installerOverrideModeState;


        let updateQuery;
        let values;

        if (mode === 'MM') {
            updateQuery = `UPDATE devices SET manualFanSpeed = ? WHERE deviceId = ?`;
            values = [fanSpeedDetails.FS, deviceId];
        } else if (mode === 'IOS') {
            // Conditional update based on installerOverrideModeState
            if (installerOverrideModeState === 1) {
                updateQuery = `UPDATE devices SET iosFanSpeed = ? WHERE deviceId = ?`;
            } else {
                updateQuery = `UPDATE devices SET iosFanSpeedOffMode = ? WHERE deviceId = ?`;
            }
            values = [fanSpeedDetails.FS, deviceId];
        } else {
            throw new CustomError("Invalid mode specified");
        }

        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Successfully Fan Speed updated" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};





exports.setHumidity = async (req, res) => {
    try {
        const humDetails = req.body;
        // const afiliateCode = req.headers.afiliatecode;

        const deviceId = humDetails.deviceId;
        const mode = humDetails.MODE;

        const [fRows] = await connection.execute(`SELECT * FROM devices WHERE deviceId = ?`, [deviceId]);

        if (fRows.length === 0) {
            throw new CustomError("Device not found!", 404);
        }

        let updateQuery;
        let values;

        if (mode === 'MM') {
            updateQuery = `UPDATE devices SET manualHum = ? WHERE deviceId = ?`;
            values = [humDetails.hum, deviceId];
        } else if (mode === 'IOS') {
            updateQuery = `UPDATE devices SET iosHum = ? WHERE deviceId = ?`;
            values = [humDetails.hum, deviceId];





        } else {
            throw new CustomError("Invalid mode specified");
        }

        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            if (mode === 'IOS') {
                const updateAutoQuery = 'UPDATE devices SET autoModeState = ? WHERE deviceId = ?';
                const valuesAuto = [true, deviceId];

                const [uRowsUpdate] = await connection.execute(updateAutoQuery, valuesAuto);

                if (uRowsUpdate.affectedRows > 0) {

                    const updateQuery = 'UPDATE devices SET installerOverrideModeState = ? WHERE deviceId = ?';
                    const values = [true, deviceId];
                    const [uRows] = await connection.execute(updateQuery, values);

                    // Call the ModeSendCommand function
                    ModeSendCommand(deviceId);
                    return res.status(200).json({ success: true, message: 'Successfully updated Installer Override ModeState' });
                } else {
                    throw new CustomError('Failed to update autoModeState', 500);
                }
            } else {
                return res.status(200).json({ success: true, message: "Successfully updated Humidity settings" });
            }

        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};
/*
exports.showModeSettings = async (req, res) => {
    try {
        const fanSpeedDetails = req.body;
        const [rows] = await connection.execute(`SELECT manualFanSpeed, iosFanSpeed, autoModeState, manualModeState, installerOverrideModeState, manualHum,iosHum FROM devices where deviceId = ?`, [fanSpeedDetails.deviceId]);

        if (rows.length >= 0) {
            const { id, deviceID, manualFanSpeed, iosFanSpeed, autoModeState, manualModeState, installerOverrideModeState, manualHum, iosHum } = rows[0];

            const transformedData = {
                manualFanSpeed,
                iosFanSpeed,
                autoModeState: autoModeState === 1,
                manualModeState: manualModeState === 1,
                installerOverrideModeState: installerOverrideModeState === 1,
                manualHum: manualHum === 1,
                iosHum: iosHum === 1
            };

            return res.status(200).json({
                success: true,
                message: "Fen Speed Information",
                data: transformedData
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occured' });
    }
};
*/

exports.showModeSettings = async (req, res) => {
    try {
        const fanSpeedDetails = req.body;

        const [rows] = await connection.execute(`SELECT location, manualFanSpeed, iosFanSpeed, iosFanSpeedOffMode, 
            autoModeState, manualModeState, installerOverrideModeState, ssId, wifiPassword,
            manualHum, iosHum FROM devices where deviceId = ?`, [fanSpeedDetails.deviceId]);

        if (rows.length > 0) {
            const { location, manualFanSpeed, iosFanSpeed, iosFanSpeedOffMode, ssId,
                wifiPassword, autoModeState, manualModeState, installerOverrideModeState, manualHum, iosHum } = rows[0];

            // console.log("iosFanSpeed:", iosFanSpeed);
            // console.log("iosFanSpeedOffMode:", iosFanSpeedOffMode);
            // console.log("installerOverrideModeState:", installerOverrideModeState);

            let iosFanSpeedValue;
            if (installerOverrideModeState === 1) {
                iosFanSpeedValue = iosFanSpeed;
            } else {
                iosFanSpeedValue = iosFanSpeedOffMode;
            }

            const transformedData = {
                manualFanSpeed,
                location: location,
                iosFanSpeed: iosFanSpeedValue,
                autoModeState: Boolean(autoModeState),
                manualModeState: Boolean(manualModeState),
                installerOverrideModeState: Boolean(installerOverrideModeState),
                manualHum: Boolean(manualHum),
                iosHum: Boolean(iosHum),
                ssId: ssId,
                wifiPassword: wifiPassword,



            };

            return res.status(200).json({
                success: true,
                message: "Fan Speed Information",
                data: transformedData
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Device not found"
            });
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};



// Function to update device state in the database
const updateAutoModeState = async (deviceId, newState) => {
    try {
        // Convert 'AMOK' to 1 (true) and handle other values as needed
        const updatedState = newState === 'AMOK' ? 1 : 0; // Assuming 'AMOK' sets it to true, else false
        manualModeState = 0;
        const updateQuery = `UPDATE devices SET autoModeState = ?,manualModeState = ? WHERE deviceId = ?`;
        const values = [updatedState, manualModeState, deviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return {
                success: true,
                message: "Successfully updated"
            };
        } else {
            throw new CustomError("Device not found or no changes made.");
        }
    } catch (err) {
        throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
    }
};

// New function to update manualModeState and autoModeState
const updateManualModeState = async (deviceId) => {
    try {
        const updateQuery = `UPDATE devices SET manualModeState = 1, autoModeState = 0 WHERE deviceId = ?`;
        const values = [deviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return {
                success: true,
                message: "Successfully updated manualModeState and autoModeState"
            };
        } else {
            throw new CustomError("Device not found or no changes made.");
        }
    } catch (err) {
        throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
    }
};


exports.AutoModeSett = async (req, res) => {

    const { host, port, username, password } = mqttConfig;


    // const host = 'hairdresser.cloudmqtt.com';
    // const port = '15520';
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

    const deviceId = req.body.deviceId;
    const autoModeState = req.body.autoModeState;

    // Validate $deviceId and $switchValue as needed.
    const commandTopic = deviceId + 'S';
    const subscribeTopic = deviceId + 'P'; // Assuming 'P' is the new status topic

    let message;

    const [rows] = await connection.execute(
        `SELECT installerOverrideModeState, iosFanSpeed, iosHum FROM devices WHERE deviceId = ?`,
        [deviceId]
    );

    // Check if the query returned any rows
    if (rows.length > 0) {
        const deviceData = rows[0];

        //ios fanspeed mapping

        const rangeSetiosFanSpeed = fanRangeSet(deviceData.iosFanSpeed);


        // Update the message object based on the fetched values
        if (autoModeState === true) {
            // Auto Mode ON
            message = {
                MODE: 1,
                HUM: deviceData.iosHum,
                // FS: deviceData.iosFanSpeed,
                FS: rangeSetiosFanSpeed,
                SETTING: deviceData.installerOverrideModeState,// You might need to change this value based on your logic
            };
        } else {
            const result = await updateManualModeState(deviceId);

            if (result.success) {
                if (autoModeState === true) {
                    // Auto Mode response
                    res.status(200).json({ success: true, message: 'Auto mode ON' });
                }
                // else if (payload.toString() === 'MMOK') {
                //     // Manual Mode response
                //     res.status(200).json({ success: true, message: 'Manual mode ON' });
                //     // Update manualModeState and autoModeState
                //     await updateManualModeState(deviceIdWithoutSuffix);
                // }
            } else {
                res.status(404).json({ success: false, message: result.message });
            }
        }
    } else {
        // Handle the case where no rows were found for the given deviceId
        message = { "MODE": 1, "HUM": 1, "FS": 30, "SETTING": 0 };
    }


    let responseSent = false;

    const sendErrorResponse = () => {
        if (!responseSent) {
            res.status(500).json({ success: false, message: 'MQTT connection error' });
            responseSent = true;
        }
    };

    // Error handler for MQTT client
    client.on('error', (error) => {
        console.error('MQTT connection error:', error);
        sendErrorResponse();
    });


    if (autoModeState === true) {
        client.on('connect', () => {
            console.log('Connected');

            // Disconnect the client before reconnecting
            client.end(() => {
                console.log('Client disconnected');

                // Reconnect and perform the necessary operations
                const newClient = mqtt.connect(connectUrl, {
                    clientId,
                    clean: true,
                    connectTimeout: 4000,
                    username,
                    password,
                    reconnectPeriod: 1000,
                });
                // const { host, port, connectUrl, options } = mqttConfig;

                // const newClient = mqtt.connect(connectUrl, options);

                newClient.subscribe([subscribeTopic], () => {
                    console.log(`Subscribe to topic '${subscribeTopic}'`);
                    newClient.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                        console.log(`Publish to topic '${commandTopic}'`);
                        if (error) {
                            console.error(error);
                        }
                    });
                    setTimeout(() => {
                        if (!responseSent) {
                            console.log('No response received within 5 seconds. Handling as communication error.');
                            res.status(500).json({ success: false, message: 'Communication error: No response received from the device.' });
                            responseSent = true;
                        }
                    }, 5000); // 5 seconds timeout
                });

                // let responseSent = false;
                newClient.on('message', async (topic, payload) => {

                    try {
                        if (responseSent) {
                            // If the response has already been sent, ignore subsequent messages
                            console.log('Ignoring additional messages after response has been sent.');
                            return;
                        }
                        const deviceIdWithoutSuffix = topic.slice(0, -1);

                        if (payload.toString() !== 'AMOK') {
                            console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                            res.status(400).json({ success: false, message: 'Invalid payload' });
                            responseSent = true;
                            return; // Return here to prevent further execution
                        }


                        const result = await updateAutoModeState(deviceIdWithoutSuffix, payload.toString());

                        if (result.success) {
                            if (autoModeState === true) {
                                // Auto Mode response
                                res.status(200).json({ success: true, message: 'Auto mode ON' });
                            }
                            // else (payload.toString() === 'MMOK') {
                            //     // Manual Mode response
                            //     res.status(200).json({ success: true, message: 'Manual mode ON' });
                            //     // Update manualModeState and autoModeState
                            //     await updateManualModeState(deviceIdWithoutSuffix);
                            // }
                        } else {
                            res.status(404).json({ success: false, message: result.message });
                        }
                        responseSent = true;


                    } catch (err) {
                        res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                        responseSent = true;
                    }
                });

            });
        });
    }
    else {
        res.status(200).json({ success: true, message: 'Manual mode ON' });
    };
}

/*
exports.InstallerOveModeSet = async (req, res) => {
    try {
        const InstallerOveModeSet = req.body;
        // const afiliateCode = req.headers.afiliatecode;

        const deviceId = InstallerOveModeSet.deviceId;
        const installerState = InstallerOveModeSet.installerState;

        const [fRows] = await connection.execute(`SELECT * FROM devices WHERE deviceId = ?`, [deviceId]);

        if (fRows.length === 0) {
            throw new CustomError("Device not found!", 404);
        }

        let updateQuery;
        let values;

        updateQuery = `UPDATE devices SET installerOverrideModeState = ? WHERE deviceId = ?`;
        values = [installerState, deviceId];


        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Successfully Installer Override ModeState updated" });
        } else {
            throw new CustomError("Something went wrong!");
        }

    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};
*/

exports.InstallerOveModeSet = async (req, res) => {
    try {
        const { deviceId, installerState } = req.body;

        const [fRows] = await connection.execute('SELECT * FROM devices WHERE deviceId = ?', [deviceId]);

        if (fRows.length === 0) {
            throw new CustomError('Device not found!', 404);
        }

        //installerOverrideModeState update
        const updateQuery = 'UPDATE devices SET installerOverrideModeState = ? WHERE deviceId = ?';
        const values = [installerState, deviceId];
        const [uRows] = await connection.execute(updateQuery, values);

        if (uRows.affectedRows > 0) {


            const updateAutoQuery = 'UPDATE devices SET autoModeState = ? WHERE deviceId = ?';
            const valuesAuto = [true, deviceId];

            const [uRowsUpdate] = await connection.execute(updateAutoQuery, valuesAuto);

            console.log("installerState", installerState);
            //call mode settings
            ModeSendCommand(deviceId);


            return res.status(200).json({ success: true, message: 'Successfully updated Installer Override ModeState' });
        } else {
            throw new CustomError('Something went wrong!', 500);
        }
    } catch (err) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
    }
};










//manual mode and auto mode worked code
/*
exports.AutoModeSett = async (req, res) => {
    const host = 'hairdresser.cloudmqtt.com';
    const port = '15520';
    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
    const connectUrl = `mqtt://${host}:${port}`;

    const client = mqtt.connect(connectUrl, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        username: 'qckwnpwm',
        password: 'n4KBne_O5Mr9',
        reconnectPeriod: 1000,
    });

    const deviceId = req.body.deviceId;
    const autoModeState = req.body.autoModeState;

    // Validate $deviceId and $switchValue as needed.
    const commandTopic = deviceId + 'S';
    const subscribeTopic = deviceId + 'P'; // Assuming 'P' is the new status topic

    let message;

    const [rows] = await connection.execute(
        `SELECT installerOverrideModeState, iosFanSpeed, iosHum FROM devices WHERE deviceId = ?`,
        [deviceId]
    );

    // Check if the query returned any rows
    if (rows.length > 0) {
        const deviceData = rows[0];

        // Update the message object based on the fetched values
        if (autoModeState === true) {
            // Auto Mode ON
            message = {
                MODE: 1,
                HUM: deviceData.iosHum,
                FS: deviceData.iosFanSpeed,
                SETTING: deviceData.installerOverrideModeState,// You might need to change this value based on your logic
            };
        } else {
            const [rows] = await connection.execute(
                `SELECT  manualFanSpeed, manualHum FROM devices WHERE deviceId = ?`,
                [deviceId]
            );

            if (rows.length > 0) {
                const deviceManualData = rows[0];

                // Manual Mode Command
                message = {
                    MODE: 2,
                    HUM: deviceManualData.manualHum, // Replace with the actual value for manual mode
                    FS: deviceManualData.manualFanSpeed, // Replace with the actual value for manual mode
                };
            }
        }
    } else {
        // Handle the case where no rows were found for the given deviceId
        message = { "MODE": 1, "HUM": 1, "FS": 30, "SETTING": 0 };
    }


    client.on('connect', () => {
        console.log('Connected');

        // Disconnect the client before reconnecting
        client.end(() => {
            console.log('Client disconnected');

            // Reconnect and perform the necessary operations
            const newClient = mqtt.connect(connectUrl, {
                clientId,
                clean: true,
                connectTimeout: 4000,
                username: 'qckwnpwm',
                password: 'n4KBne_O5Mr9',
                reconnectPeriod: 1000,
            });
            // const { host, port, connectUrl, options } = mqttConfig;

            // const newClient = mqtt.connect(connectUrl, options);

            newClient.subscribe([subscribeTopic], () => {
                console.log(`Subscribe to topic '${subscribeTopic}'`);
                newClient.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                    console.log(`Publish to topic '${commandTopic}'`);
                    if (error) {
                        console.error(error);
                    }
                });
            });

            let responseSent = false;
            newClient.on('message', async (topic, payload) => {

                try {
                    if (responseSent) {
                        // If the response has already been sent, ignore subsequent messages
                        console.log('Ignoring additional messages after response has been sent.');
                        return;
                    }
                    const deviceIdWithoutSuffix = topic.slice(0, -1);

                    if (payload.toString() !== 'AMOK') {
                        console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                        res.status(400).json({ success: false, message: 'Invalid payload' });
                        responseSent = true;
                        return; // Return here to prevent further execution
                    }


                    const result = await updateAutoModeState(deviceIdWithoutSuffix, payload.toString());

                    if (result.success) {
                        if (autoModeState === true) {
                            // Auto Mode response
                            res.status(200).json({ success: true, message: 'Auto mode ON' });
                        }
                        else if (payload.toString() === 'MMOK') {
                            // Manual Mode response
                            res.status(200).json({ success: true, message: 'Manual mode ON' });
                            // Update manualModeState and autoModeState
                            await updateManualModeState(deviceIdWithoutSuffix);
                        }
                    } else {
                        res.status(404).json({ success: false, message: result.message });
                    }
                    responseSent = true;


                } catch (err) {
                    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                    responseSent = true;
                }
            });

        });
    });
};
*/
/*
exports.ManualMode = async (req, res) => {
    const host = 'hairdresser.cloudmqtt.com';
    const port = '15520';
    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
    const connectUrl = `mqtt://${host}:${port}`;

    const client = mqtt.connect(connectUrl, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        username: 'qckwnpwm',
        password: 'n4KBne_O5Mr9',
        reconnectPeriod: 1000,
    });

    const deviceId = req.body.deviceId;
    const autoModeState = req.body.autoModeState;

    // Validate $deviceId and $switchValue as needed.
    const commandTopic = deviceId + 'S';
    const subscribeTopic = deviceId + 'P'; // Assuming 'P' is the new status topic

    let message;

    const [rows] = await connection.execute(
        `SELECT installerOverrideModeState, iosFanSpeed, iosHum FROM devices WHERE deviceId = ?`,
        [deviceId]
    );

    // Check if the query returned any rows
    if (rows.length > 0) {
        const deviceData = rows[0];

        // Update the message object based on the fetched values
        if (autoModeState === true) {
            // Auto Mode ON
            message = {
                MODE: 1,
                HUM: deviceData.iosHum,
                FS: deviceData.iosFanSpeed,
                SETTING: deviceData.installerOverrideModeState,// You might need to change this value based on your logic
            };
        } else {
            const [rows] = await connection.execute(
                `SELECT  manualFanSpeed, manualHum FROM devices WHERE deviceId = ?`,
                [deviceId]
            );

            if (rows.length > 0) {
                const deviceManualData = rows[0];

                // Manual Mode Command
                message = {
                    MODE: 2,
                    HUM: deviceManualData.manualHum, // Replace with the actual value for manual mode
                    FS: deviceManualData.manualFanSpeed, // Replace with the actual value for manual mode
                };
            }
        }
    } else {
        // Handle the case where no rows were found for the given deviceId
        message = { "MODE": 1, "HUM": 1, "FS": 30, "SETTING": 0 };
    }


    client.on('connect', () => {
        console.log('Connected');

        // Disconnect the client before reconnecting
        client.end(() => {
            console.log('Client disconnected');

            // Reconnect and perform the necessary operations
            const newClient = mqtt.connect(connectUrl, {
                clientId,
                clean: true,
                connectTimeout: 4000,
                username: 'qckwnpwm',
                password: 'n4KBne_O5Mr9',
                reconnectPeriod: 1000,
            });
            // const { host, port, connectUrl, options } = mqttConfig;

            // const newClient = mqtt.connect(connectUrl, options);

            newClient.subscribe([subscribeTopic], () => {
                console.log(`Subscribe to topic '${subscribeTopic}'`);
                newClient.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                    console.log(`Publish to topic '${commandTopic}'`);
                    if (error) {
                        console.error(error);
                    }
                });
            });

            let responseSent = false;
            newClient.on('message', async (topic, payload) => {

                try {
                    if (responseSent) {
                        // If the response has already been sent, ignore subsequent messages
                        console.log('Ignoring additional messages after response has been sent.');
                        return;
                    }
                    const deviceIdWithoutSuffix = topic.slice(0, -1);

                    if (payload.toString() !== 'AMOK') {
                        console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                        res.status(400).json({ success: false, message: 'Invalid payload' });
                        responseSent = true;
                        return; // Return here to prevent further execution
                    }


                    const result = await updateAutoModeState(deviceIdWithoutSuffix, payload.toString());

                    if (result.success) {
                        if (autoModeState === true) {
                            // Auto Mode response
                            res.status(200).json({ success: true, message: 'Auto mode ON' });
                        } else if (payload.toString() === 'MMOK') {
                            // Manual Mode response
                            res.status(200).json({ success: true, message: 'Manual mode ON' });
                            // Update manualModeState and autoModeState
                            await updateManualModeState(deviceIdWithoutSuffix);
                        }
                    } else {
                        res.status(404).json({ success: false, message: result.message });
                    }
                    responseSent = true;


                } catch (err) {
                    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                    responseSent = true;
                }
            });

        });
    });
};
*/