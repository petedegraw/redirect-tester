const { http, https } = require('follow-redirects');
const xlsxFile = require('read-excel-file/node');
const fs = require('fs');
const PDFDocument = require('./utils/pdfkit-tables');

// Create a document
const doc = new PDFDocument({width: 1800, margin: 50});
    

var d = new Date();

// Pipe its output somewhere, like to a file or HTTP response
// See below for browser usage
doc.pipe(fs.createWriteStream('./data/reports/dmo-863--prod.pdf'));

doc.font('Helvetica')
    .fontSize(14)
    .text('DMO-863 Redirect Tests -- Production')
    .moveDown(.5);

doc.fontSize(10)
    .text('Tested on ' + d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' by Pete DeGraw')
    .moveDown(.5);

let fails = 0;

let table0 = {
    headers: [
        'From',
        // 'To',
        'Actual',
        'Result'],
    rows: []
};

let redirectReport = [];
let count = 0;
xlsxFile('./data/redirects/dmo-863.xlsx').then((rows) => {
    rows.forEach((col, index)=>{
        if (index > 0) {
            let from = 'https://www.equinix.co.jp' + col[0];
            let to = 'https://www.equinix.co.jp' + col[1];
            https.get(from, response => {
                let url = response.responseUrl;
                let result = url === to;
                let report = [
                    from,
                    // to,
                    url,
                    result ? 'PASS' : 'FAIL'
                ];
                // redirectReport.push(report);
                if (result === false) {
                    fails++;
                }
                table0.rows.push(report);
                // console.table(table0.rows)
                count++;

                if (count === rows.length - 1) {
                    // console.table(redirectReport);
                    // console.log(table0)
                    // Finalize PDF file
                    doc.fontSize(12)
                        .font('Helvetica-Bold')
                        .text(fails > 0 ? 'Result: FAIL' : 'Result: PASS')
                        .moveDown(0.5);
                    if (result === true) {
                        doc.image('media/qcpassed.png', 520, 25, {
                            fit: [50, 50],
                            align: 'right',
                            valign: 'top'
                        });
                    } else {
                        doc.image('media/fail.jpg', 520, 25, {
                            fit: [50, 50],
                            align: 'right',
                            valign: 'top'
                        });
                    }
                    doc.table(table0, {
                        prepareHeader: () => doc.font('Helvetica-Bold'),
                        prepareRow: (row, i) => doc.font('Helvetica').fontSize(8)
                    });
                    doc.end();
                }
            }).on('error', err => {
                console.error(err);
            });
        }
    });
});