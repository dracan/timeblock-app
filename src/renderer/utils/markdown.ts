import { TimeEntry } from '../types';
import { formatTime24 } from './time';

export function entriesToMarkdown(entries: TimeEntry[], date: Date): string {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sorted = [...entries].sort((a, b) => a.startMinutes - b.startMinutes);

  let md = `# ${dateStr}\n\n`;

  for (const entry of sorted) {
    const start = formatTime24(entry.startMinutes);
    const end = formatTime24(entry.endMinutes);
    md += `## ${start} - ${end} | ${entry.title}\n`;
    md += `- **Color:** ${entry.color}\n`;
    md += `- **ID:** ${entry.id}\n`;
    if (entry.done) {
      md += `- **Done:** true\n`;
    }
    md += `\n`;
  }

  return md;
}

export function markdownToEntries(md: string): TimeEntry[] {
  const entries: TimeEntry[] = [];
  const blockRegex = /^## (\d{2}:\d{2}) - (\d{2}:\d{2}) \| (.+)$/gm;

  let match;
  while ((match = blockRegex.exec(md)) !== null) {
    const [, startStr, endStr, title] = match;
    const startMinutes = parseTimeStr(startStr);
    const endMinutes = parseTimeStr(endStr);

    // Look for metadata lines after the heading (limited to before the next heading)
    const afterMatch = md.slice(match.index + match[0].length);
    const nextHeading = afterMatch.indexOf('\n## ');
    const metadata = nextHeading >= 0 ? afterMatch.slice(0, nextHeading) : afterMatch;
    const colorMatch = metadata.match(/- \*\*Color:\*\* (#[0-9a-fA-F]{6})/);
    const idMatch = metadata.match(/- \*\*ID:\*\* (.+)/);
    const doneMatch = metadata.match(/- \*\*Done:\*\* true/);

    entries.push({
      id: idMatch ? idMatch[1].trim() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title,
      startMinutes,
      endMinutes,
      color: colorMatch ? colorMatch[1] : '#4a9eff',
      done: !!doneMatch,
    });
  }

  return entries;
}

function parseTimeStr(str: string): number {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}
