const dotenv = require('dotenv');
var colors = require('colors');
const { http, https } = require('follow-redirects');
const xlsxFile = require('read-excel-file/node');
const fs = require('fs');
const PDFDocument = require('./utils/pdfkit-tables');
const { exec } = require('child_process');

dotenv.config();


if (!process.env.domains) {
    console.error('Oops, first create a .env file and add domains=https://mywebsite.com,https://mywebsite.com.jp'.red);
    return;
}

let domains = process.env.domains.split(',');
let d = new Date();
// Create a document
const doc = new PDFDocument({width: 1800, margin: 50});

doc.pipe(fs.createWriteStream(process.env.dir_path + '/data/reports/dmo-863--prod.pdf'));

doc.font('Helvetica')
    .fontSize(14)
    .text('DMO-863 Redirect Tests — Production')
    .moveDown(.5);

doc.fontSize(10)
    .text('Tested on ' + d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) + ' by Pete DeGraw')
    .moveDown(.5);

let table0 = {
    headers: [
        'Expected',
        'Observed',
        'Status'],
    rows: []
};

// let redirectReport = [];
let fails = 0;
let count = 0;
let urlCount = 0;
let rowsCount = 0;

function finalizePdf(domain) {
    console.log('[✔]'.green.bold, '-'.grey, 'testing complete'.magenta, '-'.grey, domain);
    if (table0.rows.length === domains.length * (rowsCount - 1)) {
        console.log('finalizing pdf'.grey);
        // console.table(redirectReport);
        // Finalize PDF file
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .text(fails > 0 ? 'Ticket Status: FAILED' : 'Result: PASSED')
            .moveDown(0.5);
        if (fails === 0) {
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
        exec('open ' + process.env.dir_path + '/data/reports/dmo-863--prod.pdf', (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            // console.log(`stdout: ${stdout}`);
        });
    }
}

console.log('testing redirects'.gray);

domains.forEach(domain => {
    // console.log('...'.green + domain.green);

    xlsxFile(process.env.dir_path + '/data/redirects/dmo-863.xlsx').then((rows) => {
        rowsCount = rows.length;

        rows.forEach((col, index)=>{

            // skip the "to" and "from" row
            if (index > 0) {
                
                    let from = domain + col[0];
                    let to = domain + col[1];

                    https.get(from, response => {
                        let url = response.responseUrl;
                        let result = url === to;
                        let report = [
                            to,
                            url,
                            result ? 'PASSED' : 'FAILED'
                        ];
                        // redirectReport.push(report);
                        if (result === false) {
                            fails++;
                        }
                        
                        // publish the results
                        table0.rows.push(report);
                        urlCount++;

                        // checks
                        // console.log(count, urlCount, rows.length - 1);
                        // console.log('domains:', count, domains.length - 1);
                        // console.log('build:', table0.rows.length, domains.length * (rowsCount - 1))
                        // console.log('fails', fails);

                        // conclude all rows
                        if (urlCount === rows.length - 1) {
                            // conclude domain
                            count++;
                            // reset urlCounter
                            urlCount = 0;
                            // finalize PDF
                            finalizePdf(domain);
                        }
                        
                    }).on('error', err => {
                        console.error(err);
                    });

            } // end skipping "to" and "from" row

        });
    });

});