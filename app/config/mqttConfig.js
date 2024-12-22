require('dotenv').config();

//Hive Mqtt
// module.exports = {
//     host: '5afd371b88794242919269d9c2748634.s1.eu.hivemq.cloud',
//     port: 8883,
//     protocol: 'mqtts',
//     username: 'qckwnpwm',
//     password: 'n4KBne_O5Mr9'
// };

//example acees Hove mqtt function
//------------------------------------------------------
//Hive mqtt
// const client = mqtt.connect(options);
//------------------------------------------------------

//cloud mqtt
/*
const mqttConfig = {
    host: 'hairdresser.cloudmqtt.com',
    port: '15520',
    username: 'qckwnpwm',
    password: 'n4KBne_O5Mr9'

};
module.exports = mqttConfig;
*/

const mqttConfig = {

    host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD

};
module.exports = mqttConfig;