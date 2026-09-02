import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const YELLOW = "#F5C518";
const IVORY = "#F6F1E4";
const MUTED = "#A39A86";
const GRID = "#2A261C";

const tooltipStyle = {
  background: "#16140F",
  border: "1px solid #2A261C",
  borderRadius: 12,
  color: IVORY,
  fontSize: 12,
};

export function ResponsesLine({ data }: { data: Array<{ day: string; n: number }> }) {
  const rows = data.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" stroke={MUTED} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis stroke={MUTED} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="n" name="Responses" stroke={YELLOW} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourcePie({ data }: { data: Array<{ source: string; n: number }> }) {
  const colors = [YELLOW, "#E8D48A", "#8A7A3A", MUTED];
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No source data yet.</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="n" nameKey="source" innerRadius={48} outerRadius={78} paddingAngle={3}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OptionBars({ data }: { data: Array<{ label: string; n: number }> }) {
  const rows = data.map((d) => ({
    ...d,
    label: d.label.length > 22 ? `${d.label.slice(0, 22)}…` : d.label,
  }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={110} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="n" name="Responses" fill={YELLOW} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreBars({ data }: { data: Array<{ bucket: string; n: number }> }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="bucket" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="n" name="Candidates" fill={YELLOW} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourBars({ data }: { data: Array<{ hour: number; n: number }> }) {
  const rows = data.map((d) => ({ ...d, label: `${d.hour}` }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
          <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="n" name="Responses" fill={YELLOW} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
