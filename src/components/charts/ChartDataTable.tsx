import type { ChartDatum } from './chartTheme';
import { formatCents } from '@/lib/money';

// Every chart ships its numbers as a visually hidden table, so screen-reader
// users (and anyone who can't hover) get the same values the tooltip shows.
export default function ChartDataTable({
  caption,
  data,
  formatValue = formatCents,
}: {
  caption: string;
  data: ChartDatum[];
  formatValue?: (cents: number) => string;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {data.map((d, i) => (
          <tr key={`${d.label}-${i}`}>
            <th scope="row">{d.label}</th>
            <td>{formatValue(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
