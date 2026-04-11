const fs = require('fs');
const glob = require('glob');

function redact(fileContent) {
    let replaced = fileContent;
    // Replace all those leaked secrets explicitly
    replaced = replaced.replace(/bu_7f6cBASbHaJRcp0In_QyHk9X8MjhwsD4irgZ70eWt3A/g, 'bu_REDACTED');
    replaced = replaced.replace(/bu_jC1_C3Byd2V9sA48mEf8TWOoQzvn3hmWGtZd0yJevgk/g, 'bu_REDACTED');
    replaced = replaced.replace(/bu_g4faSN9Pz1lqAnA1vJabh0orDcN0tmhgpSt3g4610ts/g, 'bu_REDACTED');
    replaced = replaced.replace(/AIzaSyDwf1Sqc8pDH5LF7HnNINQiNEY96jxH1SA/g, 'AIzaSy_REDACTED');
    replaced = replaced.replace(/AIzaSyCXYK6jgmeepKRZYtj9yBNWdEI1tQK6J4Y/g, 'AIzaSy_REDACTED');
    replaced = replaced.replace(/AIzaSyDJARVGTQMW2qtPKW1lg3TjJ9UeZZhgiNc/g, 'AIzaSy_REDACTED');
    replaced = replaced.replace(/AIzaSyC_-KEUk59MvrUOpmbKmFTg_OWM5FtdZNY/g, 'AIzaSy_REDACTED');
    replaced = replaced.replace(/AIzaSyC34rqDXxQ4wGjSm2izJQ0Qr1Q4vlS1g2k/g, 'AIzaSy_REDACTED');
    replaced = replaced.replace(/AIzaSyCohm3LnbT2T_Yf1AA6J83KpcFv0zt92Ts/g, 'AIzaSy_REDACTED');
    return replaced;
}

const files = glob.sync('**/*.{md,txt,py,json}', { ignore: 'node_modules/**' });
for (const file of files) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const redacted = redact(content);
        if (content !== redacted) {
            fs.writeFileSync(file, redacted);
            console.log(`Redacted secrets in ${file}`);
        }
    }
}
