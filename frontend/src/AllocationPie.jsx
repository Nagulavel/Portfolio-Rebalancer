import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { COLORS, TOOLTIP_STYLE } from './chartTheme.js'

// Donut of shares. items: [{ ticker, [dataKey]: percent }]; a stock keeps its colour across charts.
function AllocationPie({ items, dataKey, height = 260 }) {
  const data = items.filter((item) => item[dataKey] > 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey="ticker" innerRadius={55} outerRadius={90} stroke="#111827" isAnimationActive={false}>
          {data.map((item) => (
            <Cell key={item.ticker} fill={COLORS[items.indexOf(item) % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => `${v}%`} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#e5e9f0' }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default AllocationPie
