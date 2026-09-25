import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '../lib/format'
import { CHART_COLORS } from '../lib/colors'

/** data: [{ name, value (cents), color? }] */
function DonutChart({ data, centerTop, centerBottom, size = 220 }) {
  const hasData = data.some((d) => d.value > 0)
  const chartData = hasData ? data : [{ name: 'Nothing yet', value: 1, color: '#e6e0dd' }]

  return (
    <div className={`donut ${size < 200 ? 'compact' : ''}`} style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" stroke="none" isAnimationActive={false}>
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          {hasData && <Tooltip formatter={(value) => formatMoney(value)} />}
        </PieChart>
      </ResponsiveContainer>
      {(centerTop || centerBottom) && (
        <div className="donut-center">
          <strong>{centerTop}</strong>
          <span className="muted">{centerBottom}</span>
        </div>
      )}
    </div>
  )
}

export default DonutChart
