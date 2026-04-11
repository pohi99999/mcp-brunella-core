const fs = require('fs');

const file = 'src/server/routes/testScheduler.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/req: Request<EmptyParams, ErrorResponse \| ScheduleUpdateResponse, ScheduleUpdateBody>/g, 'req: any');
content = content.replace(/req: Request<EmptyParams, ErrorResponse \| TestResultsListResponse, never, ResultsQuery>/g, 'req: any');
content = content.replace(/req: Request<TestRunParams, ErrorResponse \| TestRunResponse>/g, 'req: any');
content = content.replace(/req: Request<DateRangeParams, ErrorResponse \| DateRangeResponse>/g, 'req: any');

// Also match where there's optional spaces or linebreaks
// It is better to just replace Request<...something...> with "any" globally but testScheduler has multiple lines for arguments sometimes
// e.g.:
// async (
//   req: Request<EmptyParams, ErrorResponse | ScheduleUpdateResponse, ScheduleUpdateBody>,
//   res: Response<ErrorResponse | ScheduleUpdateResponse>
// ) => {
content = content.replace(/req:\s*Request<[^>]+>/g, 'req: any');
content = content.replace(/req:\s*Request/g, 'req: any');
content = content.replace(/res:\s*Response<[^>]+>/g, 'res: any');
content = content.replace(/res:\s*Response/g, 'res: any');

fs.writeFileSync(file, content);
