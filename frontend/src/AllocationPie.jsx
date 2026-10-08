import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { COLORS, TOOLTIP_STYLE } from './chartTheme.js'

// Donut of shares. items: [{ ticker, [dataKey]: percent }]; a stock keeps its colour across charts.
function AllocationPie({ items, dataKey, height = 290 }) {
  const data = items.filter((item) => item[dataKey] > 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey="ticker"
          innerRadius={55}
          outerRadius={90}
          stroke="#ffffff"
          isAnimationActive={false}
          // Percentage next to every slice
          label={({ value }) => `${value}%`}
          labelLine={{ stroke: '#656d76' }}
          fontSize={12}
        >
          {data.map((item) => (
            <Cell key={item.ticker} fill={COLORS[items.indexOf(item) % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => `${v}%`} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#1f2328' }} />
        <Legend formatter={(ticker) => `${ticker} ${data.find((item) => item.ticker === ticker)?.[dataKey]}%`} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default AllocationPie
