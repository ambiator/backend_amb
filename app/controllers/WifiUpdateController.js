const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');
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



// const updateOtaState = async (deviceId) => {
//     try {
//         const updateQuery = `UPDATE devices SET otaState = 1 WHERE deviceId = ?`;
//         const values = [deviceId];
//         const [uRows] = await connection.execute(updateQuery, values);

//         if (uRows.affectedRows > 0) {
//             return {
//                 success: true,
//                 message: "Successfully updated"
//             };
//         } else {
//             throw new CustomError("Something went wrong!");
//         }
//     } catch (err) {
//         throw new CustomError(err.message || 'An error occurred', err.statusCode || 500);
//     }
// };


exports.updateWifi = async (req, res) => {
    try {
        const { deviceId, ssid, password } = req.body;

        const [result] = await connection.execute(`
            UPDATE devices 
            SET ssId = ?, wifiPassword = ? 
            WHERE deviceId = ?`, [ssid, password, deviceId]);

        if (result.affectedRows > 0) {
           
          await this.WifiUpdateCommand(req, res);

        } 
        return res.status(200).json({ success: true, message: 'Data Updated Successfully' });


    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'An error occurred' });
    }
};



// Main function to send a command and update device state
exports.WifiUpdateCommand = async (req, res) => {
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

    const deviceId = req.body.deviceId;
    // const switchValue = req.body.switchValue;
    // Validate $deviceId and $switchValue as needed.
    const commandTopic = deviceId + 'S';
    const subscribeTopic = deviceId + 'P'; // Assuming 'P' is the new status topic

    let message;

    const [rows] = await connection.execute(
        `SELECT ssId, wifiPassword FROM devices WHERE deviceId = ?`,
        [deviceId]
    );

    if (rows.length > 0) {
        const deviceWifiData = rows[0];
        message = {
            'wifiSSID': deviceWifiData.ssId,
            'wifiPASSWORD': deviceWifiData.wifiPassword,
        };
    }


    let responseSent = false;

    // Initialize MQTT client before subscribing
    initializeMqttClient();

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
                res.status(500).json({ success: false, message: 'Communication error: No response received from the device.' });
                responseSent = true;
                mqttClient.end();
            }
        }, 5000); // 5 seconds timeout
    });

    // let responseSent = false;
    mqttClient.on('message', async (topic, payload) => {

        try {
            if (responseSent) {
                // If the response has already been sent, ignore subsequent messages
                console.log('Ignoring additional messages after response has been sent.');
                return;
            }

            const deviceIdWithoutSuffix = topic.slice(0, -1);
            const response = payload.toString().trim();

            if (response === 'UPDATED') {
                // Handle OTA upgrade success
                // const result = await updateOtaState(deviceIdWithoutSuffix);
                const successMessage = 'Wifi Command send successfully';
                res.status(200).json({ success: true, message: successMessage });
            }
            else {
                // Handle other unexpected responses
                const invalidMessage = `Ignoring message with invalid payload '${response}' on topic '${topic}'`;
                console.log(invalidMessage);
                res.status(400).json({ success: false, message: 'Invalid payload' });
            }
            responseSent = true;

        } catch (err) {
            res.status(err.statusCode || 500).json({ success: false, message: err.message || 'An error occurred' });
            responseSent = true;
        }
    });


};


exports.fanRangeSet = async (req, res) => {
    let fanSpeed;
    const iosFanSpeed = req.body.iosFanSpeed;
    
    if (iosFanSpeed >= 30 && iosFanSpeed <= 100) {
        // Linearly map iosFanSpeed between 30 and 100 to fanSpeed between 500 and 1040
        fanSpeed = 500 + ((iosFanSpeed - 30) * (1040 - 500) / (100 - 30));
    } else if (iosFanSpeed > 100 && iosFanSpeed <= 115) {
        // Linearly map iosFanSpeed between 100 and 115 to fanSpeed between 1040 and 149
        fanSpeed = 1040 + ((iosFanSpeed - 100) * (149 - 1040) / (115 - 100));
    } else if (iosFanSpeed < 30) {
        // If below 30, clamp to 500
        fanSpeed = 500;
    } else {
        // If above 115, clamp to 149
        fanSpeed = 149;
    }

    // Round fanSpeed to the nearest integer
    fanSpeed = Math.round(fanSpeed);

    return res.status(200).json({ success: true, fanSpeed: fanSpeed });
};



