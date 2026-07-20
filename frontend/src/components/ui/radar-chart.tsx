import { Radar, RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface RadarChartProps {
  data: {
    subject: string
    A: number
    fullMark: number
  }[]
}

export function RadarChart({ data }: RadarChartProps) {
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" className="text-xs" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          <Tooltip />
          <Radar
            name="Ứng viên"
            dataKey="A"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.4}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
