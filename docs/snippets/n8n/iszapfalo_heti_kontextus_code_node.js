// n8n Code node — Iszapfaló Heti Kontextus Csomag
// Cél: több Airtable node outputjából egy Claude-kompatibilis Markdown riportot készíteni.
// Ajánlott workflow node-nevek:
// - Airtable - Folyamatok lekérdezés
// - Airtable - Feladatok lekérdezés
// - Airtable - Munkatársak lekérdezés
// - Airtable - Szabadságok lekérdezés
// - Airtable - Munkaidő Nyilvántartás   (opcionális)
//
// Output:
// - json.markdown: kész riport szöveg
// - json.fileName: Google Drive-ba feltölthető fájlnév
// - binary.report: markdown fájl bináris tartalma
//
// Következő node javaslat:
// Google Drive Upload -> Binary Property: report

const NODE_NAMES = {
  projects: 'Airtable - Folyamatok lekérdezés',
  tasks: 'Airtable - Feladatok lekérdezés',
  staff: 'Airtable - Munkatársak lekérdezés',
  vacations: 'Airtable - Szabadságok lekérdezés',
  timesheet: 'Airtable - Munkaidő Nyilvántartás',
};

function safeAll(nodeName) {
  try {
    return $(nodeName).all().map((item) => item.json ?? {});
  } catch {
    return [];
  }
}

function pick(record, keys, fallback = '') {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return fallback;
}

function asNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatHungarianDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  const amount = asNumber(value, 0);
  return new Intl.NumberFormat('hu-HU').format(amount);
}

function escapePipe(value) {
  return String(value ?? '-').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function normalizeProject(project) {
  return {
    name: pick(project, ['Folyamat neve', 'Projekt', 'Name', 'Név'], 'Ismeretlen projekt'),
    status: pick(project, ['Státusz', 'Status'], 'Ismeretlen'),
    delayDays: asNumber(pick(project, ['Késés napokban', 'Késés', 'DelayDays'], 0), 0),
    owner: pick(project, ['Felelős', 'Tulajdonos', 'Owner'], 'Nincs megadva'),
    deadline: pick(project, ['Határidő', 'Deadline'], ''),
    openTasks: asNumber(pick(project, ['Feladatok száma', 'Nyitott feladatok száma', 'OpenTasks'], 0), 0),
    price: asNumber(pick(project, ['Kiajánlott Ár', 'Ár', 'Price'], 0), 0),
    reason: pick(project, ['Késés oka', 'Blokkoló ok', 'Megjegyzés'], ''),
  };
}

function normalizeTask(task) {
  return {
    name: pick(task, ['Feladat neve', 'Feladat', 'Task', 'Name'], 'Névtelen feladat'),
    priority: pick(task, ['Prioritás', 'Priority'], 'Nincs megadva'),
    status: pick(task, ['Státusz', 'Status'], 'Ismeretlen'),
    owner: pick(task, ['Felelős', 'Assignee', 'Tulajdonos'], 'Nincs megadva'),
    project: pick(task, ['Folyamat kapcsolat', 'Projekt', 'Kapcsolódó folyamat'], 'Nincs projekt'),
    deadline: pick(task, ['Határidő', 'Deadline'], ''),
  };
}

function normalizeStaff(person) {
  return {
    name: pick(person, ['Név', 'Name'], 'Ismeretlen munkatárs'),
    role: pick(person, ['Beosztás', 'Role'], 'Nincs megadva'),
    workload: asNumber(pick(person, ['Feladat leterheltség (%)', 'Leterheltség %', 'Workload'], 0), 0),
    chatId: pick(person, ['Telegram Chat ID', 'Chat ID'], ''),
    relatedProjects: pick(person, ['Kapcsolódó folyamatok', 'Projects'], ''),
  };
}

function normalizeVacation(vacation) {
  return {
    name: pick(vacation, ['Munkatárs neve', 'Munkatárs', 'Név', 'Name'], 'Ismeretlen'),
    start: pick(vacation, ['Szabadság kezdete', 'Kezdés', 'Start', 'Start Date'], ''),
    end: pick(vacation, ['Szabadság vége', 'Vége', 'End', 'End Date'], ''),
    type: pick(vacation, ['Típus', 'Type'], 'Szabadság'),
  };
}

function normalizeTimeEntry(entry) {
  return {
    name: pick(entry, ['Munkatárs', 'Név', 'Name'], 'Ismeretlen'),
    hours: asNumber(pick(entry, ['Ledolgozott órák', 'Óraszám', 'Hours'], 0), 0),
    project: pick(entry, ['Projekt', 'Fő projekt', 'Kapcsolódó folyamat'], '-'),
    date: pick(entry, ['Dátum', 'Date'], ''),
  };
}

function tableRow(cells) {
  return `| ${cells.map(escapePipe).join(' | ')} |`;
}

function bulletList(items, emptyText = '- Nincs adat') {
  if (!items.length) return emptyText;
  return items.map((item) => `- ${item}`).join('\n');
}

const now = new Date();
const day = now.getDay();
const diffToMonday = day === 0 ? -6 : 1 - day;
const periodStart = new Date(now);
periodStart.setDate(now.getDate() + diffToMonday);
const periodEnd = new Date(periodStart);
periodEnd.setDate(periodStart.getDate() + 6);

const rawProjects = safeAll(NODE_NAMES.projects);
const rawTasks = safeAll(NODE_NAMES.tasks);
const rawStaff = safeAll(NODE_NAMES.staff);
const rawVacations = safeAll(NODE_NAMES.vacations);
const rawTimesheet = safeAll(NODE_NAMES.timesheet);

const projects = rawProjects.map(normalizeProject);
const tasks = rawTasks.map(normalizeTask);
const staff = rawStaff.map(normalizeStaff);
const vacations = rawVacations.map(normalizeVacation);
const timesheet = rawTimesheet.map(normalizeTimeEntry);

const delayedProjects = [...projects]
  .filter((project) => project.delayDays > 0)
  .sort((a, b) => b.delayDays - a.delayDays);

const criticalProjects = delayedProjects.filter((project) => project.delayDays >= 30);
const billingWaiting = projects.filter((project) =>
  ['Számlázásra vár', 'Billing Pending', 'Billing'].includes(project.status),
);
const blockedProjects = projects.filter((project) =>
  !project.owner || project.owner === 'Nincs megadva' || Boolean(project.reason),
);

const prioritizedTasks = [...tasks]
  .filter((task) => ['Magas', 'High'].includes(task.priority))
  .filter((task) => ['Új', 'Folyamatban', 'New', 'In Progress'].includes(task.status))
  .sort((a, b) => {
    const dateA = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
  });

const vacationsByName = new Map();
for (const vacation of vacations) {
  const label = `${formatHungarianDate(vacation.start)} → ${formatHungarianDate(vacation.end)} (${vacation.type})`;
  const current = vacationsByName.get(vacation.name) ?? [];
  current.push(label);
  vacationsByName.set(vacation.name, current);
}

const timesheetByName = new Map();
for (const entry of timesheet) {
  const current = timesheetByName.get(entry.name) ?? { hours: 0, projectHours: new Map() };
  current.hours += entry.hours;
  current.projectHours.set(entry.project, (current.projectHours.get(entry.project) ?? 0) + entry.hours);
  timesheetByName.set(entry.name, current);
}

const activeProjectsTable = projects.length
  ? projects
      .sort((a, b) => b.delayDays - a.delayDays)
      .map((project) => tableRow([
        project.name,
        project.status,
        project.delayDays,
        project.owner,
        project.openTasks,
        formatHungarianDate(project.deadline),
      ]))
      .join('\n')
  : tableRow(['Nincs adat', '-', '-', '-', '-', '-']);

const highPriorityTasksTable = prioritizedTasks.length
  ? prioritizedTasks
      .map((task) => tableRow([
        task.name,
        task.owner,
        task.project,
        task.status,
        formatHungarianDate(task.deadline),
      ]))
      .join('\n')
  : tableRow(['Nincs magas prioritású feladat', '-', '-', '-', '-']);

const staffAvailabilityTable = staff.length
  ? staff
      .sort((a, b) => b.workload - a.workload)
      .map((person) => {
        const vacationsLabel = (vacationsByName.get(person.name) ?? []).join(', ') || 'Nem';
        const notes = [
          person.chatId ? `Telegram: ${person.chatId}` : 'Telegram: hiányzik',
          person.relatedProjects ? `Kapcsolódó projektek: ${person.relatedProjects}` : '',
        ].filter(Boolean).join(' | ');

        return tableRow([
          person.name,
          person.role,
          person.workload,
          vacationsLabel,
          notes || '-',
        ]);
      })
      .join('\n')
  : tableRow(['Nincs adat', '-', '-', '-', '-']);

const weeklyHoursTable = timesheet.length
  ? Array.from(timesheetByName.entries())
      .map(([name, summary]) => {
        let mainProject = '-';
        let maxHours = -1;
        for (const [project, hours] of summary.projectHours.entries()) {
          if (hours > maxHours) {
            maxHours = hours;
            mainProject = project;
          }
        }
        return { name, hours: summary.hours, mainProject };
      })
      .sort((a, b) => b.hours - a.hours)
      .map((entry) => tableRow([entry.name, entry.hours.toFixed(1), entry.mainProject]))
      .join('\n')
  : tableRow(['Még nincs munkaidő adat', '0', '-']);

const pipelineTotal = projects.reduce((sum, project) => sum + project.price, 0);
const totalWeeklyHours = Array.from(timesheetByName.values()).reduce((sum, entry) => sum + entry.hours, 0);

const markdown = [
  '# Heti Kontextus Csomag',
  '',
  `**Dátum:** ${formatDate(now)}  `,
  `**Időszak:** ${formatDate(periodStart)} → ${formatDate(periodEnd)}  `,
  '**Forrás:** Airtable + n8n  ',
  '**Cél:** Heti vezetői és operatív kontextus Claude számára  ',
  '',
  '---',
  '',
  '## 1. Vezetői összkép',
  '',
  `- Aktív projektek száma: **${projects.length}**`,
  `- Késésben lévő projektek száma: **${delayedProjects.length}**`,
  `- Magas prioritású nyitott feladatok száma: **${prioritizedTasks.length}**`,
  `- Szabadságon lévő munkatársak: **${vacationsByName.size}**`,
  `- Előző heti összes munkaidő: **${totalWeeklyHours.toFixed(1)} óra**`,
  `- Ajánlati / projekt pipeline becsült összértéke: **${formatCurrency(pipelineTotal)} Ft**`,
  '',
  '---',
  '',
  '## 2. Aktív projektek',
  '',
  '| Projekt | Státusz | Késés (nap) | Felelős | Nyitott feladat | Határidő |',
  '| --- | --- | ---: | --- | ---: | --- |',
  activeProjectsTable,
  '',
  '---',
  '',
  '## 3. Kritikus projektek',
  '',
  '### 30+ napos késések',
  bulletList(
    criticalProjects.map((project) => `${project.name} — ${project.delayDays} nap késés — Felelős: ${project.owner}`),
    '- Nincs 30 napnál nagyobb késés',
  ),
  '',
  '### Számlázásra váró / pénzügyileg sürgős elemek',
  bulletList(
    billingWaiting.map((project) => `${project.name} — státusz: ${project.status} — érték: ${formatCurrency(project.price)} Ft`),
    '- Nincs ilyen projekt',
  ),
  '',
  '### Gazdátlan vagy blokkolt projektek',
  bulletList(
    blockedProjects.map((project) => {
      const suffix = project.reason ? ` — ok: ${project.reason}` : '';
      return `${project.name} — felelős: ${project.owner || 'hiányzik'}${suffix}`;
    }),
    '- Nincs blokkolt vagy gazdátlan projekt',
  ),
  '',
  '---',
  '',
  '## 4. Magas prioritású feladatok',
  '',
  '| Feladat | Felelős | Projekt | Státusz | Határidő |',
  '| --- | --- | --- | --- | --- |',
  highPriorityTasksTable,
  '',
  '---',
  '',
  '## 5. Munkatárs elérhetőség',
  '',
  '| Név | Beosztás | Leterheltség % | Szabadság | Megjegyzés |',
  '| --- | --- | ---: | --- | --- |',
  staffAvailabilityTable,
  '',
  '---',
  '',
  '## 6. Előző heti munkaidő',
  '',
  '| Név | Óraszám | Fő projekt |',
  '| --- | ---: | --- |',
  weeklyHoursTable,
  '',
  '---',
  '',
  '## 7. Pénzügyi pipeline',
  '',
  `- Ajánlati / projekt pipeline összértéke: **${formatCurrency(pipelineTotal)} Ft**`,
  bulletList(
    projects
      .filter((project) => project.price > 0)
      .sort((a, b) => b.price - a.price)
      .slice(0, 5)
      .map((project) => `${project.name} — ${formatCurrency(project.price)} Ft — státusz: ${project.status}`),
    '- Nincs ár/érték adat',
  ),
  '',
  '---',
  '',
  '## 8. Claude számára ajánlott kérdések',
  '',
  '- Milyen legyen a jövő heti munkarend?',
  '- Melyik projektekre kell most fókuszálni?',
  '- Ki túlterhelt, és ki vállalhat még feladatot?',
  '- Hol vannak a legsürgősebb pénzügyi prioritások?',
  '- Mi legyen a jövő hét top 3 vezetői fókusza?',
].join('\n');

const fileName = `Heti_Kontextus_${formatDate(now).replace(/-/g, '')}.md`;
const binaryData = Buffer.from(markdown, 'utf8').toString('base64');

return [
  {
    json: {
      fileName,
      markdown,
      reportDate: formatDate(now),
      periodStart: formatDate(periodStart),
      periodEnd: formatDate(periodEnd),
      stats: {
        activeProjects: projects.length,
        delayedProjects: delayedProjects.length,
        highPriorityTasks: prioritizedTasks.length,
        staffOnVacation: vacationsByName.size,
        totalWeeklyHours,
        pipelineTotal,
      },
    },
    binary: {
      report: {
        data: binaryData,
        mimeType: 'text/markdown',
        fileName,
        fileExtension: 'md',
      },
    },
  },
];
