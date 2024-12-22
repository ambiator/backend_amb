const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sql = require('../config/dbSql');


// Image extension
function getExtension(image) {
    const extension = image.substring(image.indexOf('/') + 1, image.indexOf(';'));
    if (extension === 'jpg') {
        return 'jpg';
    } else if (extension === 'png') {
        return 'png';
    } else if (extension === 'jpeg') {
        return 'jpeg';
    } else if (extension === 'mp4') {
        return 'mp4';
    } else if (extension === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return 'xlsx';
    } else {
        return extension;
    }
}

// Image storing function
function storeFile(image, folder) {
    if (image) {
        const folderPath = path.join('app/public/', folder);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });      // If the folder doesn't exist, create it
        }
        const extension = getExtension(image);
        const base64Data = image.split(',')[1];;
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imageName = `${folder}/${uuidv4()}.${extension}`;
        const imagePath = path.join(`app/public/`, imageName);

        fs.writeFileSync(imagePath, imageBuffer);

        return imageName;
    } else {
        return 'No image data found';
    }
};


// function uniqueId(callback) {
//     const fetch = 'SELECT * FROM supplier ORDER BY id DESC LIMIT 1';

//     sql.query(fetch, (err, results) => {
//         if (err) return callback(err, null);

//         if (results.length === 0) return callback(null, 'SUP-1');

//         const sId = results[0].sId || 'SUP-0'; 

//         // Extract the numeric part and increment by 1
//         const len = parseInt(sId.split('-')[1]);
//         const increment = len + 1;
//         const newStr = 'SUP-' + increment;

//         return callback(null, newStr);
//     });
// }

function uniqueId(array, callback) {
    const tabelName = array[0];
    const idPrefix = array[1];
    const uId = array[2];

    const fetch = `SELECT * FROM ${tabelName} ORDER BY id DESC LIMIT 1`;
    sql.query(fetch, (err, results) => {
        if (err) return callback(err, null);
        if (results.length === 0) return callback(null, `${idPrefix}-1`);
        const string = results[0][uId] || `${idPrefix}-0`;
        // Extract the numeric part and increment by 1
        const len = parseInt(string.split('-')[1])
        const increment = len + 1;
        const newStr = `${idPrefix}-` + increment;
        callback(null, newStr);
    });
}


function exportFile(res, docPath, fileName) {
    const filePath = path.join(docPath);
    if (fs.existsSync(filePath)) {
        const fileExtension = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream'; // Default content type for unknown file types
        const exportedName = fileName + fileExtension;

        switch (fileExtension) {
            case '.pdf':
                contentType = 'application/pdf';
                break;
            case '.xlsx':
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
            case '.jpg':
            case '.jpeg':
                contentType = 'image/jpeg';
                break;
            case '.png':
                contentType = 'image/png';
                break;
        }

        // Set the appropriate headers for the response
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${exportedName}`);

        // Stream the file to the response
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } else {
        res.status(404).send('File not found');
    }
}

function fanRangeSet(iosFanSpeed) {

    let fanSpeed;

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
        fanSpeed = 1040;
    }

    // Round fanSpeed to the nearest integer
    fanSpeed = Math.round(fanSpeed);

    return fanSpeed;

    // return res.status(200).json({ success: true, fanSpeed: fanSpeed });

}








module.exports = { storeFile, uniqueId, exportFile, fanRangeSet };