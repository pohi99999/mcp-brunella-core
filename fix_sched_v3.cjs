const fs = require('fs');

const file = 'src/server/routes/testScheduler.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/req: Request<EmptyParams, ErrorResponse \| ScheduleUpdateResponse, ScheduleUpdateBody>,/g, 'req: any,');
content = content.replace(/req: Request<EmptyParams, ErrorResponse \| TestResultsListResponse, never, ResultsQuery>,/g, 'req: any,');
content = content.replace(/req: Request<TestRunParams, ErrorResponse \| TestRunResponse>,/g, 'req: any,');
content = content.replace(/req: Request<DateRangeParams, ErrorResponse \| DateRangeResponse>,/g, 'req: any,');
content = content.replace(/res: Response<[^>]+>/g, 'res: any');

fs.writeFileSync(file, content);
console.log("Done");
