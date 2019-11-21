'use strict';
// load your environment containing the secret API key
require('dotenv').config()

const API_KEY = process.env.API_KEY
const fs = require("fs");
const rp = require("request-promise");
const express = require('express');
const app = express();
const PORT = process.env.PORT || 1111;
const bodyParser = require('body-parser');
const multiParty = require('connect-multiparty');
const KILOBYTES_PER_MEGABYTE = 1024;
const maxFilesSizeKb = 50 * KILOBYTES_PER_MEGABYTE;
const maxTotalFilesSizeKb = 100 * KILOBYTES_PER_MEGABYTE;
const FILE_UPLOAD_TIMEOUT = process.env.FILE_UPLOAD_TIMEOUT ? process.env.FILE_UPLOAD_TIMEOUT : '5m';
const timeout = require('connect-timeout');
const SPromise = require('bluebird');
var unlink = SPromise.promisify(fs.unlink);


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
    extended: false
}));

// parse application/json
app.use(bodyParser.json());

app.listen(PORT, () => {
    console.log('Tag gun application is running on the port', PORT);
});

app.post('/ocr-receipt', timeout(FILE_UPLOAD_TIMEOUT), multiParty({
    maxFilesSizeKb
}), async (req, res) => {
    try {
        console.log(req.body, req.files);
        var file = req.files.file;
        if (!file) {
            return res.status(400).send({
                message: 'Bad Request'
            });
        }
        var path = file.path;
        let formData = {
            file: []
        };
        let params = {};
        var files = [path];

        for (var i = 0; i < files.length; i++) {
            const file = files[i]
            formData.file.push({
                value: fs.createReadStream(file),
                options: {
                    filename: file,
                    contentType: 'image/jpg'
                }
            })
        }

        formData = Object.assign({}, formData, params);

        const options = {
            method: 'POST',
            formData: formData,
            uri: `https://api.tabscanner.com/api/2/process`,
            headers: {
                'apikey': API_KEY
            },
            rejectUnauthorized: false
        };

        const results = await rp(options);
        console.log('process API result', JSON.parse(results));
        console.log('token from API', JSON.parse(results).token);
        const token = JSON.parse(results).token;
        console.log('token', token);

        const resultOptions = {
            method: 'GET',
            uri: `https://api.tabscanner.com/api/result/${token}`,
            headers: {
                'apikey': API_KEY
            },
            rejectUnauthorized: false
        };
        const result = await rp(resultOptions);
        console.log('final API result', JSON.parse(result));
        return res.status(200).send(JSON.parse(result));
    } catch (err) {
        console.error(err);
        return res.status(400).send(err);
    } finally {
        return unlink(req.files.file.path);
    }
});


app.get('/get-result/:token', async (req, res)=>{
   try{
       const token = req.params.token;
    const resultOptions = {
        method: 'GET',
        uri: `https://api.tabscanner.com/api/result/${token}`,
        headers: {
            'apikey': API_KEY
        },
        rejectUnauthorized: false
    };
    const result = await rp(resultOptions);
    console.log('final API result', JSON.parse(result));
    return res.status(200).send(JSON.parse(result));
   }catch (err) {
    console.error(err);
    return res.status(400).send(err);
   }
});