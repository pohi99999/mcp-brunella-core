const fs = require('fs');

const file = 'src/server/routes/testScheduler.ts';
let content = fs.readFileSync(file, 'utf8');

// I'll just change the types manually avoiding the overly broad regex I used before
content = content.replace(/req: Request<EmptyParams, ErrorResponse \| ScheduleUpdateResponse, ScheduleUpdateBody>/g, 'req: any');
content = content.replace(/req: Request<EmptyParams, ErrorResponse \| TestResultsListResponse, never, ResultsQuery>/g, 'req: any');
content = content.replace(/req: Request<TestRunParams, ErrorResponse \| TestRunResponse>/g, 'req: any');
content = content.replace(/req: Request<DateRangeParams, ErrorResponse \| DateRangeResponse>/g, 'req: any');
content = content.replace(/req: Request/g, 'req: any');
content = content.replace(/res: Response<[^>]*>/g, 'res: any');
content = content.replace(/res: Response/g, 'res: any');
fs.writeFileSync(file, content);

console.log('Fixed sched correctly');
