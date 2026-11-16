"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { formatIQD } from "@/lib/format";

const PASTELS = ["#FB8FAC", "#60B8F1", "#5CC99B", "#A685F7", "#FCC421", "#8D64E8", "#3D9BDD", "#FFCF79"];

export function SalesAreaChart({ series }: { series: { label: string; total: number; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A685F7" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#FB8FAC" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 8" stroke="rgba(58,53,80,0.08)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: "#6f688a" }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 10, fontWeight: 700, fill: "#6f688a" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          orientation="right"
        />
        <Tooltip
          formatter={(v: unknown) => [formatIQD(Number((v as number) ?? 0)), "المبيعات"] as [string, string]}
          labelFormatter={(l) => `تاريخ ${l}`}
          contentStyle={{ borderRadius: 16, border: "1px solid rgba(58,53,80,0.08)", fontSize: 12, fontWeight: 800, fontFamily: "Cairo" }}
        />
        <Area type="monotone" dataKey="total" stroke="#8D64E8" strokeWidth={2.5} fill="url(#salesGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PaymentsPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} cornerRadius={8}>
          {data.map((_, i) => (
            <Cell key={i} fill={PASTELS[i % PASTELS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: unknown) => formatIQD(Number((v as number) ?? 0))}
          contentStyle={{ borderRadius: 16, border: "1px solid rgba(58,53,80,0.08)", fontSize: 12, fontWeight: 800, fontFamily: "Cairo" }}
        />
        <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[11px] font-bold text-ink">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

type ChartsProps =
  | { view: "area"; sales: { label: string; total: number; count: number }[] }
  | { view: "pie"; payments: { id: string; name: string; value: number }[] }
  | { view: "bar"; governorates: { name: string; total: number }[] };

export default function Charts(props: ChartsProps) {
  if (props.view === "pie") return <PaymentsPie data={props.payments} />;
  if (props.view === "bar") return <GovBar data={props.governorates} />;
  return <SalesAreaChart series={props.sales} />;
}

export function GovBar({ data }: { data: { name: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 8" stroke="rgba(58,53,80,0.08)" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 10, fontWeight: 700, fill: "#3a3550" }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(v: unknown) => [formatIQD(Number((v as number) ?? 0)), "المبيعات"] as [string, string]}
          contentStyle={{ borderRadius: 16, border: "1px solid rgba(58,53,80,0.08)", fontSize: 12, fontWeight: 800, fontFamily: "Cairo" }}
        />
        <Bar dataKey="total" radius={[10, 10, 10, 10]} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill={PASTELS[i % PASTELS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
