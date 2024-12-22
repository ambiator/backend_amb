const express = require("express");
const mqttHandler = require('./app/controllers/deviceStatusController.js');
const mqttTemperatureHandler = require('./app/controllers/TemperatureIncommingMqtt.js');
const DeviceErrorStatusHandler = require('./app/controllers/DeviceErrorStatusHandler.js');
const DeviceData = require('./app/controllers/deviceDataIncomingMqtt.js');
const FanSpeedIncoming = require('./app/controllers/IncomingData/FanSpeedIncoming.js')
const app = express();
require('dotenv').config();
const cors = require('cors');

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static('app/public'));

process.on('SIGINT', () => {
    console.log('Closing MQTT connections');
    mqttHandler.client.end();
    mqttTemperatureHandler.client.end();
    DeviceErrorStatusHandler.client.end();
    DeviceData.client.end();
    FanSpeedIncoming.client.end();
    process.exit();
});

require('./app/service/mainRoutes')(app);

app.listen(process.env.APP_PORT, process.env.APP_HOST, () => {
    console.log(`Server running on http://${process.env.APP_HOST}:${process.env.APP_PORT}`);
});
