const { http, https } = require('follow-redirects');

const from = 'https://www.equinix.com/solutions/cloud-infrastructure/';
const to = 'https://www.equinix.com/solutions/?industry=cloud-services';

https.get(from, response => {
    console.log(response)
    let url = response.responseUrl;
    let result = url === to;
    let report = [
        from,
        to,
        url,
        result ? 'PASSED' : 'FAILED'
    ];

    console.table(report);
    
}).on('error', err => {
    console.error(err);
});