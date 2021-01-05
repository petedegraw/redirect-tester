const fs = require('fs');
const dotenv = require('dotenv');
const { exec } = require('child_process');
var colors = require('colors');
const inquirer = require('inquirer');
const PDFDocument = require('./utils/pdfkit-tables');
const { http, https } = require('follow-redirects');
const xlsxFile = require('read-excel-file/node');

dotenv.config();

if (!process.env.domains) {
    console.error(
        'Oops, first create a .env file and add domains=https://mywebsite.com,https://mywebsite.com.jp'
            .red
    );
    return;
}

let domains = process.env.domains.split(',');
let d = new Date();
let d_file = new Date().toISOString().replace(/:/gi, '-').split('.')[0];

// !script timer
function parseHrtimeToSeconds(hrtime) {
    var seconds = (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
    return seconds;
}

// !requestURL
const requestURL = async (from, to) => {
    return new Promise((resolve, reject) => {
        let url, report;
        https
            .get(from, (response) => {
                console.log('      testing -'.gray, from.gray);
                url = response.responseUrl;
                let result = url === to;
                report = [from, to, url, result ? 'PASSED' : 'FAILED'];
                // console.log(response);
                if (url.length > 0) {
                    resolve(report);
                } else {
                    reject();
                }
            })
            .on('error', (err) => {
                console.error(err);
            });
    });
};

fs.readdir(process.env.redirects_path, function (err, files) {
    //handling error
    if (err) {
        return console.log('Unable to find or open the directory: ' + err);
    }

    let redirect_files = [];
    files.forEach((file) => {
        if (file !== '.DS_Store' && file.split('.')[1] === 'xlsx') {
            redirect_files.push(file);
        }
    });
    inquirer
        .prompt([
            {
                type: 'rawlist',
                name: 'redirect_file',
                message: 'Choose a the source file for the redirects to test:',
                choices: redirect_files,
            },
            {
                type: 'rawlist',
                name: 'environment',
                message: 'Choose the environment where the test should be run:',
                choices: process.env.environments.split(','),
            },
        ])
        .then((answers) => {
            // Create a document
            const doc = new PDFDocument({ width: 1800, margin: 50, bufferPages: true });
            const redirects_file = process.env.redirects_path + '/' + answers.redirect_file;
            const report_file =
                process.env.reports_path +
                '/' +
                answers.redirect_file.split('.')[0] +
                '-' +
                answers.environment +
                '-' +
                d_file +
                '.pdf';
            doc.pipe(fs.createWriteStream(report_file));
            doc.font('Helvetica')
                .fontSize(14)
                .text(
                    'Redirect Tests: ' +
                        answers.redirect_file.split('.')[0].toUpperCase() +
                        ' — Production'
                )
                .moveDown(0.5);
            doc.fontSize(10)
                .text(
                    'Tested on ' +
                        d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) +
                        ' by Pete DeGraw'
                )
                .moveDown(0.5);
            let table0 = {
                headers: ['Redirected URL', 'Expected', 'Observed', 'Status'],
                rows: [],
            };
            // let redirectReport = [];
            let fails = 0;
            let count = 0;
            let urlCount = 0;
            let rowsCount = 0;
            function finalizePdf(domain) {
                console.log(
                    '[✔]'.green.bold,
                    '-'.grey,
                    'testing complete'.magenta,
                    '-'.grey,
                    domain
                );
                let elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
                if (table0.rows.length === domains.length * rowsCount) {
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
                            valign: 'top',
                        });
                    } else {
                        doc.image('media/fail.jpg', 520, 25, {
                            fit: [50, 50],
                            align: 'right',
                            valign: 'top',
                        });
                    }
                    doc.table(table0, {
                        prepareHeader: () => doc.font('Helvetica-Bold'),
                        prepareRow: (row, i) => doc.font('Helvetica').fontSize(8),
                    });
                    doc.switchToPage(0);
                    doc.fontSize(8).text(
                        `Tested ${rowsCount * domains.length} URLs in ${elapsedSeconds} seconds (${(
                            elapsedSeconds / rowsCount
                        ).toFixed(3)} seconds per URL)`,
                        50,
                        30
                    );
                    doc.end();
                    exec('open ' + report_file, (error, stdout, stderr) => {
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
            let startTime = process.hrtime();
            xlsxFile(redirects_file).then((xlsxData) => {
                rowsCount = xlsxData.length - 1;
                async function testDomains() {
                    for (const [i, domain] of domains.entries()) {
                        // console.log(domain);
                        async function testUrls() {
                            for (const [index, data] of xlsxData.entries()) {
                                let col = xlsxData[index];
                                // skip the header row in the domain spreadsheet file
                                if (index > 0) {
                                    let from = domain + col[0];
                                    let to = domain + col[1];
                                    // console.log(from);
                                    // make https request
                                    requestURL(from, to).then((data) => {
                                        if (data.result === false) {
                                            fails++;
                                        }
                                        // add the results to the table
                                        table0.rows.push(data);
                                        urlCount++;
                                        // conclude all rows
                                        if (urlCount === rowsCount) {
                                            // conclude domain
                                            count++;
                                            // reset urlCounter
                                            urlCount = 0;
                                            // finalize PDF
                                            finalizePdf(domain);
                                        }
                                    });
                                }
                            }
                            // console.log('URLs finished');
                        }
                        testUrls();
                    }
                    // console.log('DOMAINS finished');
                }
                testDomains();
            });
        }); // end inquirer
});

return;
