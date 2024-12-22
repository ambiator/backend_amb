const { connection, CustomError } = require('../config/dbSql2');
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqttConfig.js');
const { fanRangeSet } = require('./utilityFunction.js');


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
            // console.log('Message published successfully');
        }
    });
}

async function ModeSendCommand(deviceIdWithoutSuffix) {
    try {

        initializeMqttClient();

        const deviceId = deviceIdWithoutSuffix;
        const commandTopic = deviceId + 'S';
        const subscribeTopic = deviceId + 'P';

        const [rows] = await connection.execute(`SELECT autoModeState FROM devices WHERE deviceId = ?`, [deviceId]);
        const autoModeState = rows[0]?.autoModeState;
        let message;
        const [dataRows] = await connection.execute(`SELECT installerOverrideModeState, iosFanSpeed, iosHum, manualFanSpeed, manualHum, autoHum ,autoFanSpeed FROM devices WHERE deviceId = ?`, [deviceId]);
        if (dataRows.length > 0) {
            const rowData = dataRows[0];

            const rangeSetiosFanSpeed = fanRangeSet(rowData.iosFanSpeed);


            if (autoModeState === 1) {
                if (rowData.installerOverrideModeState === 1) {
                    message = {
                        MODE: 1,
                        HUM: rowData.iosHum,
                        // FS: rowData.iosFanSpeed,
                        FS: rangeSetiosFanSpeed,
                        SETTING: rowData.installerOverrideModeState,
                    };
                }
                else {
                    message = {
                        MODE: 1,
                        HUM: rowData.autoHum,
                        // FS: rowData.autoFanSpeed,
                        FS: rangeSetiosFanSpeed,
                        SETTING: rowData.installerOverrideModeState,
                    };
                }

            } else {
                message = {
                    MODE: 2,
                    HUM: rowData.manualHum,
                    // FS: rowData.manualFanSpeed,
                    FS: rangeSetiosFanSpeed,
                    SETTING: 0,
                };
            }
        }

        /*  client.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
              if (error) {
                  console.error(error);
              } else {
                  console.log(`Published to topic '${commandTopic}'`);
              }
              client.end(() => {
                  console.log('Client disconnected');
              });
          });*/

        publishMessage(commandTopic, JSON.stringify(message));

        mqttClient.on('error', (error) => {
            console.error('MQTT Error:', error);
        });


    } catch (error) {
        console.error('An error occurred:', error);
    }
}



async function ModeSendCommand(deviceIdWithoutSuffix) {
    try {

        initializeMqttClient();

        const deviceId = deviceIdWithoutSuffix;
        const commandTopic = deviceId + 'S';
        const subscribeTopic = deviceId + 'P';

        const [rows] = await connection.execute(`SELECT autoModeState FROM devices WHERE deviceId = ?`, [deviceId]);
        const autoModeState = rows[0]?.autoModeState;
        let message;
        const [dataRows] = await connection.execute(`SELECT installerOverrideModeState, iosFanSpeed, iosHum, manualFanSpeed, manualHum FROM devices WHERE deviceId = ?`, [deviceId]);
        if (dataRows.length > 0) {
            const rowData = dataRows[0];

            const rangeSetiosFanSpeed = fanRangeSet(rowData.iosFanSpeed);


            if (autoModeState === 1) {
                message = {
                    MODE: 1,
                    HUM: 0,
                    // FS: rowData.iosFanSpeed,
                    FS: rangeSetiosFanSpeed,
                    SETTING: rowData.installerOverrideModeState,
                };
            } else {
                message = {
                    MODE: 2,
                    HUM: rowData.manualHum,
                    // FS: rowData.manualFanSpeed,
                    FS: rangeSetiosFanSpeed,
                    SETTING: 0,
                };
            }
        }

        /*  client.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
              if (error) {
                  console.error(error);
              } else {
                  console.log(`Published to topic '${commandTopic}'`);
              }
              client.end(() => {
                  console.log('Client disconnected');
              });
          });*/

        publishMessage(commandTopic, JSON.stringify(message));

        mqttClient.on('error', (error) => {
            console.error('MQTT Error:', error);
        });


    } catch (error) {
        console.error('An error occurred:', error);
    }
}






async function SetPointCommand(deviceIdWithoutSuffix) {
    try {


        const deviceId = deviceIdWithoutSuffix;
        const commandTopic = deviceId + 'S';
        const subscribeTopic = deviceId + 'P';

        const [rows] = await connection.execute(`SELECT setPointValue FROM devices WHERE deviceId = ?`, [deviceId]);
        const setPointValue = rows[0]?.setPointValue;

        let message;

        message = {
            SP: setPointValue,
        };

        /*
                client.publish(commandTopic, JSON.stringify(message), { qos: 0, retain: false }, (error) => {
                    if (error) {
                        console.error(error);
                    } else {
                        console.log(`Published to topic '${commandTopic}'`);
                    }
                    client.end(() => {
                        console.log('Client disconnected');
                    });
                });
        */

        publishMessage(commandTopic, JSON.stringify(message));

        mqttClient.on('error', (error) => {
            console.error('MQTT Error:', error);
        });

    } catch (error) {
        console.error('An error occurred:', error);
    }
}

module.exports = { ModeSendCommand, SetPointCommand };

