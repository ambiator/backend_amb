const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
//Cloud Mqtt
const mqttConfig = require('../config/mqttConfig.js');
//Hive mqtt
// const options = require('../config/mqttConfig.js');
const { ModeSendCommand, SetPointCommand } = require('../utility/DeviceStatus.js');

let mqttClient = null;

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


// Main function to send a command and update device state
exports.sendCommand = async (req, res) => {

    const deviceId = req.body.deviceId;
    const switchValue = req.body.switchValue;



    // const affiliateCode = req.headers.affiliatecode;
    const [deviceRows] = await connection.execute(`
            SELECT afiliateCode 
            FROM devices 
            WHERE deviceId = ?
        `, [deviceId]);

    // Check if the device exists
    if (deviceRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const afiliateCode = deviceRows[0].afiliateCode;

    // Second query: Check if the afiliateCode is blocked
    const [affiliateRows] = await connection.execute(`
           SELECT blockFlag 
           FROM affiliate 
           WHERE afiliateCode = ?
       `, [afiliateCode]);

    // console.log("affiliateRows", affiliateRows)

    if (affiliateRows.length > 0 && affiliateRows[0].blockFlag == 1) {
        return res.status(403).json({ success: false, message: 'Please contact the Ambiator. The device is blocked.' });
    }






    // Validate $deviceId and $switchValue as needed.
    const commandTopic = deviceId + 'S';
    const subscribeTopic = deviceId + 'P'; // Assuming 'P' is the new status topic
    const status = '$' + switchValue.toUpperCase();

    let message;

    if (status === '$START') {
        message = { "STATUS": 1 };
    } else if (status === '$STOP') {
        message = { "STATUS": 0 };
    }

    let responseSent = false;

    // Initialize MQTT client before subscribing
    initializeMqttClient();

    mqttClient.subscribe(subscribeTopic, (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
            return;
        }
        console.log('Subscribed to topic:', subscribeTopic);

        // Call the publishMessage function to publish the message
        publishMessage(commandTopic, JSON.stringify(message));
        setTimeout(() => {
            if (!responseSent) {
                console.log('No response received within 5 seconds. Handling as communication error.');
                responseSent = true;
                mqttClient.end();
                return res.status(500).json({ success: false, message: 'Communication error: No response received from the device.' });
            }
        }, 5000); // 5 seconds timeout
    });

    mqttClient.on('message', async (topic, payload) => {
        try {
            if (responseSent) {
                // If the response has already been sent, ignore subsequent messages
                console.log('Ignoring additional messages after response has been sent.');
                return;
            }

            const deviceIdWithoutSuffix = topic.slice(0, -1);
            const newState = parseInt(payload.toString(), 10);
            console.log("newState", newState)

            if (isNaN(newState) || (newState !== 0 && newState !== 1)) {
                console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                res.status(400).json({ success: false, message: 'Invalid payload' });
                responseSent = true;
                mqttClient.end();
                return; // Return here to prevent further execution
            }

            const result = await updateDeviceState(deviceIdWithoutSuffix, newState);

            // Modify response based on newState
            const successMessage = (newState === 1) ? 'Device turned on successfully.' : 'Device turned off successfully.';
            const deviceStatus = (newState === 1) ? 1 : 0;

            res.status(200).json({ message: successMessage, deviceStatus: deviceStatus });
            responseSent = true;

            if (newState === 1 && result) {
                // Call ModeSendCommand function here since newState is 1
                ModeSendCommand(deviceIdWithoutSuffix);
                SetPointCommand(deviceIdWithoutSuffix);
            }
            mqttClient.end();
        } catch (err) {
            console.error('An error occurred:', err);
            if (!responseSent) { // Ensure response hasn't been sent already
                res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
                responseSent = true;
                mqttClient.end(); // Close the MQTT client
            }
        }
    });
};


// Function to update device state in the database
const updateSetPointValue = async (deviceId, setPointValue) => {
    try {
        const updateQuery = `UPDATE devices SET setPointValue = ? WHERE deviceId = ?`;
        const values = [setPointValue, deviceId];
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

exports.sendSetPoint = async (req, res) => {
    const deviceId = req.body.deviceId;
    const setPointValue = req.body.setPointValue;
    const commandTopic = deviceId + 'S';
    const subscribeTopic = deviceId + 'P';

    const message = {
        "SP": setPointValue
    };

    // Initialize MQTT client before subscribing
    initializeMqttClient();

    // Subscribe to the response topic
    mqttClient.subscribe(subscribeTopic, (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
            return;
        }
        console.log('Subscribed to topic:', subscribeTopic);

        // Call the publishMessage function to publish the message
        publishMessage(commandTopic, JSON.stringify(message));
        setTimeout(() => {
            if (!respSent) {
                console.log('No response received within 5 seconds. Handling as communication error.');
                res.status(500).json({ success: false, message: 'Communication error: No response received from the device.' });
                respSent = true;
                mqttClient.end();
            }
        }, 5000); // 5 seconds timeout
    });

    let respSent = false;

    // Event listener for message
    mqttClient.on('message', async (topic, payload) => {
        try {
            if (respSent) {
                // If the response has already been sent, ignore subsequent messages
                console.log('Ignoring additional messages after response has been sent.');
                return;
            }

            const deviceIdWithoutSuffix = topic.slice(0, -1);

            if (payload.toString() !== 'SPOK') {
                console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                res.status(400).json({ success: false, message: 'Invalid payload' });
                respSent = true;
                return;
            }

            const newState = (payload.toString() === 'SPOK');

            if (newState) {
                // Assuming 'setPointValue' is a part of the 'message' object received from MQTT
                const setPointValue = message.SP;

                // Check if 'setPointValue' is a valid numeric value
                if (typeof setPointValue !== 'number' || isNaN(setPointValue)) {
                    throw new Error("Invalid setPointValue. It must be a numeric value.");
                }

                // Update set point value
                const result = await updateSetPointValue(deviceIdWithoutSuffix, setPointValue);

                res.status(200).json({ message: 'Set point updated' });
                respSent = true;
                mqttClient.end();
                return;
            } else {
                // Handle the case when payload is not 'SPOK'
                console.log(`Ignoring message with invalid payload '${payload.toString()}' on topic '${topic}'`);
                res.status(400).json({ success: false, message: 'Invalid payload' });
                respSent = true;
                mqttClient.end();
                return;
            }
        } catch (err) {
            console.error('An error occurred:', err);
            res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
            respSent = true;
            mqttClient.end(); // Close the MQTT client
            return;
        }
    });
};