const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');


const moment = require('moment-timezone');
const { fanRangeSet } = require('../utility/utilityFunction.js');


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
const energyKeys = ["TKW"];
const waterKeys = ["TWU"]; // Assuming TWU is the key for water usage

client.on('message', async (topic, payload) => {
    const payloadString = payload.toString();


    // Regular expression for temperature format
    const isExpectedTempFormat = /^\s*{"OT":\d+(\.\d+)?,"OH":\d+(\.\d+)?,"SL":\d+(\.\d+)?,"SP":\d+(\.\d+)?}\s*$/.test(payloadString);

    // Regular expression for energy used format
    const isExpectedEnergyUsedFormat = /^\s*{"TKW":\d+(\.\d+)?}\s*$/.test(payloadString);

    // Regular expression for water used format
    const isExpectedWaterUsedFormat = /^\s*{"TWU":\d+(\.\d+)?}\s*$/.test(payloadString);

    if (isExpectedTempFormat || isExpectedEnergyUsedFormat || isExpectedWaterUsedFormat) {
        try {
            const parsedPayload = JSON.parse(payloadString);

            if (isExpectedTempFormat) {
                const isTemperatureMessage = temperatureKeys.every(key => key in parsedPayload);
                if (subscribedTopics.has(topic) && isTemperatureMessage) {
                    handleTemperatureMessage(topic, payload);
                } else {
                    // console.log(`prajwal1 Ignoring message for topic '${topic}' with payload '${payloadString}'`);
                }
            } else if (isExpectedEnergyUsedFormat) {
                const isEnergyMessage = energyKeys.every(key => key in parsedPayload);
                if (subscribedTopics.has(topic) && isEnergyMessage) {
                    handleEnergyMessage(topic, payload);
                } else {
                    // console.log(`prajwal2 Ignoring message for topic '${topic}' with payload '${payloadString}'`);
                }
            } else if (isExpectedWaterUsedFormat) {
                const isWaterMessage = waterKeys.every(key => key in parsedPayload);
                if (subscribedTopics.has(topic) && isWaterMessage) {
                    handleWaterUsedDataMessage(topic, payload);
                } else {
                    // console.log(`prajwal3 Ignoring message for topic '${topic}' with payload '${payloadString}'`);
                }
            }
        } catch (error) {
            console.error(`prajwal4 Error parsing JSON for topic '${topic}': ${error.message}`);
            // console.log(`prajwal Ignoring message for topic '${topic}' with payload '${payloadString}'`);
        }
    } else {
        // console.log(`prajwal5 Ignoring message for topic '${topic}'. Payload does not match the expected format.with payload '${payloadString}'`);
    }
});

async function handleTemperatureMessage(topic, payload) {
    const deviceId = topic.slice(0, -1);
    console.log("deviceId handleTemperatureMessage" + deviceId);

    try {
        const tmpMessage = JSON.parse(payload.toString());

        const outTemp = tmpMessage.OT;
        const outHum = tmpMessage.OH;
        const supply = tmpMessage.SL;
        const setPoint = tmpMessage.SP;

        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const currentHour = moment().format('hA');
        const minutes = moment().format('mm');

        const roundedMinutes = Math.ceil(parseInt(minutes) / 10) * 10; // Round to the nearest ten


        // Check if a record exists for the current hour and device
        const selectQuery = `
            SELECT * FROM device_data
            WHERE deviceId = ? AND HR = ? AND  Min = ? AND DATE(dateTime) = DATE(NOW())
            LIMIT 1
            `;
        const [rows] = await connection.execute(selectQuery, [deviceId, currentHour, roundedMinutes]);

        if (roundedMinutes !== 0) {

            if (rows.length > 0) {
                // Update existing record for the current hour and device
                const updateQuery = `
                    UPDATE device_data
                    SET outTemp = ?, outHum = ?, supply = ?, setPoint = ?
                    WHERE deviceId = ? AND HR = ? AND Min = ? AND DATE(dateTime) = DATE(NOW())
                `;
                await connection.execute(updateQuery, [outTemp, outHum, supply, setPoint, deviceId, currentHour, roundedMinutes]);
                // console.log('Updated temperature record for device:', deviceId);

                handleRpmBasedEnergyMessage(deviceId);

            } else {

                // Insert new record if no record exists for the current hour and device
                const insertQuery = `
                    INSERT INTO device_data (deviceId, HR, Min, outTemp, outHum, supply, setPoint, dateTime)
                    VALUES (?, ?, ?, ?, ?, ?, ? ,?)
                `;

                const result = await connection.execute(insertQuery, [deviceId, currentHour, roundedMinutes, outTemp, outHum, supply, setPoint, dateTime])
                    .catch(error => {
                        console.error('Error executing database query:', error);
                    });

                // console.log(`Inserted into temperature table. Rows affected: ${result.affectedRows}`);
                handleRpmBasedEnergyMessage(deviceId);

            }
        }
    } catch (error) {
        console.error('Error processing temperature message:', error);
    }
}


async function handleEnergyMessage(topic, payload) {
    const deviceId = topic.slice(0, -1);
    // console.log("deviceId deviceId" + deviceId);

    try {
        const energyMessage = JSON.parse(payload.toString());


        // const selecFactor = `
        //     SELECT 
        //         energy_ghg_calculation.* 
        //     FROM 
        //         energy_ghg_calculation
        //     INNER JOIN devices ON energy_ghg_calculation.deviceType = devices.device_type
        //       WHERE devices.deviceId = ? 
        //     ORDER BY energy_ghg_calculation.startDate DESC
        //     LIMIT 1
        // `;
        // const [fRows] = await connection.execute(selecFactor, [deviceId]);


        // const PowerFactor = fRows[0].defaultEnergyUse;

        const Amps = energyMessage.TKW;
        const Voltage = 230; // Assuming voltage is constant at 230V
        const PowerFactor = 0.95; // Assuming power factor is constant at 0.92

        // Calculate energy consumption in kWh
        const getkWh = (Amps * Voltage * PowerFactor) / 1000;
        const kWh = getkWh.toFixed(2);


        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const currentHour = moment().format('hA');
        const minutes = moment().format('mm');

        const roundedMinutes = Math.ceil(parseInt(minutes) / 10) * 10; // Round to the nearest ten

        if (roundedMinutes !== 0) {

            // Check if a record exists for the current hour and device
            const selectQuery = `
                SELECT * FROM device_data
                WHERE deviceId = ? AND HR = ? AND  Min = ? AND DATE(dateTime) = DATE(NOW())
                LIMIT 1
                `;
            const [rows] = await connection.execute(selectQuery, [deviceId, currentHour, roundedMinutes]);

            if (rows.length > 0) {

                const updateQuery = `
                    UPDATE device_data
                    SET TKW = ?
                    WHERE deviceId = ? AND HR = ?  AND Min = ? AND DATE(dateTime) = DATE(NOW())
                `;
                await connection.execute(updateQuery, [kWh, deviceId, currentHour, roundedMinutes]);
                // console.log('Updated total KW record for device:', deviceId);
            } else {
                // Insert new record if no record exists for the current hour and device

                const insertQuery = `
                    INSERT INTO device_data (deviceId, HR, Min, TKW, dateTime)
                    VALUES (?, ?, ?, ?, ?)
                `;

                const result = await connection.execute(insertQuery, [deviceId, currentHour, roundedMinutes, kWh, dateTime])
                    .catch(error => {
                        console.error('Error executing database query:', error);
                    });

                // console.log(`Inserted into device data table. Rows affected: ${result.affectedRows}`);
            }
        }
    } catch (error) {
        console.error('Error processing device data message:', error);
    }
}

/*
async function handleRpmBasedEnergyMessage(deviceId) {
    try {
        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const currentHour = moment().format('hA');
        const minutes = moment().format('mm');
        const roundedMinutes = Math.ceil(parseInt(minutes) / 10) * 10; // Round to nearest 10

        // Helper function to execute queries
        async function executeQuery(query, params) {
            try {
                return await connection.execute(query, params);
            } catch (error) {
                console.error(`Error executing query: ${query}`, error);
                throw error; // Rethrow to handle in the main try-catch block
            }
        }

        // Fetch pump status and set pump watts
        const [[pumpRow]] = await executeQuery(`
            SELECT pump FROM devicestatus
            WHERE deviceId = ? AND DATE(dateTime) = DATE(NOW()) ORDER BY id DESC
            LIMIT 1
        `, [deviceId]);

        const pumpWatts = pumpRow ? (pumpRow.pump == 1 ? 120 : 0) : 0;


        // Fetch fan speed and corresponding watts
        const [[fanRow]] = await executeQuery(`
            SELECT rpm_value FROM rpm_data
            WHERE deviceId = ? AND DATE(dateTime) = DATE(NOW())
            LIMIT 1
        `, [deviceId]);

        let fanWatts = 0;
        let rpmValue = 0; // Variable to hold the final rpm value

        // Fetch device mode states and fan speeds
        const [[deviceFanRow]] = await executeQuery(`
            SELECT autoModeState, manualModeState, installerOverrideModeState, manualFanSpeed, iosFanSpeed, autoFanSpeed 
            FROM devices
            WHERE deviceId = ?
            LIMIT 1
        `, [deviceId]);

        // Determine fan speed based on mode states
        if (fanRow) {
            rpmValue = fanRow.rpm_value;

            console.log("fanRow rpmValue", rpmValue);
        } else {
            if (deviceFanRow.installerOverrideModeState == 1) {
                rpmValue = fanRangeSet(deviceFanRow.iosFanSpeed);

                console.log("installerOverrideModeState rpmValue", rpmValue)

                // rpmValue = deviceFanRow.iosFanSpeed;
            } else if (deviceFanRow.manualModeState == 1) {
                rpmValue = fanRangeSet(deviceFanRow.manualFanSpeed);

                console.log("manualModeState rpmValue", rpmValue)

                // rpmValue = deviceFanRow.manualFanSpeed;
            } else if (deviceFanRow.autoModeState == 1) {
                rpmValue = fanRangeSet(deviceFanRow.autoFanSpeed);

                console.log("autoModeState rpmValue", rpmValue)
                // rpmValue = deviceFanRow.autoFanSpeed;
            }
        }

        // Fetch the corresponding watts for the determined RPM value
        if (rpmValue) {
            const [[fanWattsRow]] = await executeQuery(`
                    SELECT watts 
                    FROM rpmwatts_table
                    WHERE rpm = (
                    SELECT rpm FROM rpmwatts_table
                    ORDER BY ABS(rpm - ?) ASC
                    LIMIT 1
            )
            `, [rpmValue]);

            fanWatts = fanWattsRow ? parseInt(fanWattsRow.watts) : 0;
        }

        // Calculate kWh
        const kwh = (fanWatts + 50 + pumpWatts) / 1000;

        console.log("fanWatts ", fanWatts, " + 50 + pumpWatts", pumpWatts, " / 1000  =", kwh)


        if (roundedMinutes !== 0) {
            // Check if record exists and insert/update accordingly
            const [[existingRecord]] = await executeQuery(`
                SELECT * FROM device_data
                WHERE deviceId = ? AND HR = ? AND Min = ? AND DATE(dateTime) = DATE(NOW())
                LIMIT 1
            `, [deviceId, currentHour, roundedMinutes]);

            if (existingRecord) {
                // Update existing record
                await executeQuery(`
                    UPDATE device_data
                    SET TKW = ?
                    WHERE deviceId = ? AND HR = ? AND Min = ? AND DATE(dateTime) = DATE(NOW())
                `, [kwh, deviceId, currentHour, roundedMinutes]);
                // console.log('Updated total KW record for device:', deviceId);
            } else {
                // Insert new record
                const result = await executeQuery(`
                    INSERT INTO device_data (deviceId, HR, Min, TKW, dateTime)
                    VALUES (?, ?, ?, ?, ?)
                `, [deviceId, currentHour, roundedMinutes, kwh, dateTime]);

                // console.log(`Inserted new record into device_data table. Rows affected: ${result.affectedRows}`);
            }
        }
    } catch (error) {
        console.error('Error processing device data message:', error);
    }
}*/

async function handleRpmBasedEnergyMessage(deviceId) {
    try {
        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const currentHour = moment().format('hA');
        const roundedMinutes = Math.ceil(moment().minute() / 10) * 10;

        // Helper function for query execution
        const executeQuery = async (query, params) => {
            try {
                return await connection.execute(query, params);
            } catch (error) {
                console.error(`Error executing query: ${query}`, error);
                throw error;
            }
        };

        // Get pump status
        const [[pumpRow]] = await executeQuery(
            `SELECT pump FROM devicestatus
             WHERE deviceId = ? AND DATE(dateTime) = CURDATE()
             ORDER BY id DESC LIMIT 1`,
            [deviceId]
        );
        const pumpWatts = pumpRow?.pump == 1 ? 120 : 0;

        // Get fan RPM
        const [[fanRow]] = await executeQuery(
            `SELECT rpm_value FROM rpm_data
             WHERE deviceId = ? AND DATE(dateTime) = CURDATE()
             LIMIT 1`,
            [deviceId]
        );
        let rpmValue = fanRow?.rpm_value;

        // Get device modes and speeds if no fan RPM is found
        if (!rpmValue) {
            const [[deviceFanRow]] = await executeQuery(
                `SELECT autoModeState, manualModeState, installerOverrideModeState, 
                        manualFanSpeed, iosFanSpeed, autoFanSpeed 
                 FROM devices WHERE deviceId = ? LIMIT 1`,
                [deviceId]
            );

            rpmValue = getRpmFromDeviceModes(deviceFanRow);


        }

        console.log("rpmValue", rpmValue);

        // Calculate fan watts based on RPM
        const fanWatts = rpmValue ? await getWattsFromRpm(rpmValue) : 0;

        console.log("fanWatts", fanWatts);

        // Calculate kWh (fan watts + constant + pump watts)
        const kwh = (fanWatts + 50 + pumpWatts) / 1000;



        if (roundedMinutes !== 0) {
            // Check if the record exists for the current hour and minutes
            const [[existingRecord]] = await executeQuery(
                `SELECT * FROM device_data
                 WHERE deviceId = ? AND HR = ? AND Min = ? AND DATE(dateTime) = CURDATE()
                 LIMIT 1`,
                [deviceId, currentHour, roundedMinutes]
            );

            if (existingRecord) {
                // Update existing record
                await executeQuery(
                    `UPDATE device_data
                     SET TKW = ? WHERE deviceId = ? AND HR = ? AND Min = ? AND DATE(dateTime) = CURDATE()`,
                    [kwh, deviceId, currentHour, roundedMinutes]
                );
            } else {
                // Insert new record
                await executeQuery(
                    `INSERT INTO device_data (deviceId, HR, Min, TKW, dateTime)
                     VALUES (?, ?, ?, ?, ?)`,
                    [deviceId, currentHour, roundedMinutes, kwh, dateTime]
                );
            }
        }
    } catch (error) {
        console.error('Error processing device data message:', error);
    }
}

// Helper function to determine RPM based on device modes
function getRpmFromDeviceModes(deviceFanRow) {
    if (deviceFanRow.installerOverrideModeState) {
        return fanRangeSet(deviceFanRow.iosFanSpeed);
    }
    if (deviceFanRow.manualModeState) {
        return fanRangeSet(deviceFanRow.manualFanSpeed);
    }
    if (deviceFanRow.autoModeState) {
        return fanRangeSet(deviceFanRow.autoFanSpeed);
    }
    return 0;
}

// Helper function to fetch watts based on RPM
async function getWattsFromRpm(rpmValue) {
    const [[fanWattsRow]] = await connection.execute(
        `SELECT watts FROM rpmwatts_table
         WHERE rpm = (SELECT rpm FROM rpmwatts_table
                      ORDER BY ABS(rpm - ?) ASC LIMIT 1)`,
        [rpmValue]
    );
    return fanWattsRow ? parseInt(fanWattsRow.watts) : 0;
}


async function handleWaterUsedDataMessage(topic, payload) {
    const deviceId = topic.slice(0, -1);
    // console.log("deviceId deviceId" + deviceId);

    try {
        const energyMessage = JSON.parse(payload.toString());

        const TWU = energyMessage.TWU;

        const dateTime = moment().format('YYYY-MM-DD HH:mm:ss');

        const currentHour = moment().format('hA');
        const minutes = moment().format('mm');

        const roundedMinutes = Math.ceil(parseInt(minutes) / 10) * 10; // Round to the nearest ten

        if (roundedMinutes !== 0) {

            // Check if a record exists for the current hour and device
            const selectQuery = `
                SELECT * FROM device_data
                WHERE deviceId = ? AND HR = ? AND  Min = ? AND DATE(dateTime) = DATE(NOW())
                LIMIT 1
            `;
            const [rows] = await connection.execute(selectQuery, [deviceId, currentHour, roundedMinutes]);

            if (rows.length > 0) {

                const updateQuery = `
                    UPDATE device_data
                    SET TWU = ?
                    WHERE deviceId = ? AND HR = ?  AND Min = ? AND DATE(dateTime) = DATE(NOW())
                `;
                await connection.execute(updateQuery, [TWU, deviceId, currentHour, roundedMinutes]);
                // console.log('Updated total KW record for device:', deviceId);

            } else {
                // Insert new record if no record exists for the current hour and device
                const insertQuery = `
                INSERT INTO device_data (deviceId, HR, Min, TWU, dateTime)
                VALUES (?, ?, ?, ?)
            `;
                const result = await connection.execute(insertQuery, [deviceId, currentHour, roundedMinutes, TWU, dateTime])
                    .catch(error => {
                        console.error('Error executing database query:', error);
                    });

                // console.log(`Inserted into device data table. Rows affected: ${result.affectedRows}`);
            }

            // Update isActive state in device_data table
            const updateIsActiveQuery = `
                UPDATE devices
                SET isActive = 1
                WHERE deviceId = ?
            `;
            await connection.execute(updateIsActiveQuery, [deviceId]);
        }


    } catch (error) {
        console.error('Error processing device data message:', error);
    }
}
