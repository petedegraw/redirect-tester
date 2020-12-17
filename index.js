const { http, https } = require('follow-redirects');
const xlsxFile = require('read-excel-file/node');

let redirectReport = [];
let count = 0;
xlsxFile('./data/redirects/dmo-863.xlsx').then((rows) => {
    rows.forEach((col, index)=>{
        if (index > 0) {
            let from = 'http://www.preview-dcm.equinix.co.jp' + col[0];
            let to = 'http://www.preview-dcm.equinix.co.jp' + col[1];
            http.get(from, response => {
                let url = response.responseUrl;
                let result = url === to;
                let report = {from, to, url, result};
                redirectReport.push(report);
                count++;
                if (count === rows.length - 1) {
                    console.table(redirectReport);
                }
            }).on('error', err => {
                console.error(err);
            });
        }
    });
});
