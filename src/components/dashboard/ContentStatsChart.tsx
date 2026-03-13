// src/components/dashboard/ContentStatsChart.tsx
import { Bar } from 'react-chartjs-2';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip
);

interface ContentStatsChartProps {
  chartData: { name: string; lessons: number; notes: number; mcqs: number; total: number }[];
}

const ContentStatsChart = ({ chartData }: ContentStatsChartProps) => {
  const { theme } = useDashboard();
  const isLight = theme === 'light';
  const labels = chartData.map(item => item.name);
  const lessonsData = chartData.map(item => item.lessons);
  const notesData = chartData.map(item => item.notes);
  const mcqsData = chartData.map(item => item.mcqs);

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Lessons',
        data: lessonsData,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 12,
      },
      {
        label: 'Notes',
        data: notesData,
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
        barThickness: 12,
      },
      {
        label: 'MCQs',
        data: mcqsData,
        backgroundColor: '#10b981',
        borderRadius: 6,
        barThickness: 12,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e5e7eb',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(255,255,255,0.96)' : '#1f2937',
        titleColor: isLight ? '#111827' : '#fff',
        bodyColor: isLight ? '#374151' : '#e5e7eb',
        borderColor: isLight ? 'rgba(0,0,0,0.08)' : '#374151',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: isLight ? '#6b7280' : '#9ca3af',
          maxRotation: 45,
        },
      },
      y: {
        grid: {
          color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(75, 85, 99, 0.2)',
          drawBorder: false,
        },
        ticks: {
          color: isLight ? '#6b7280' : '#9ca3af',
          stepSize: 10,
        },
      },
    },
  };

  const totalLessons = lessonsData.reduce((sum, val) => sum + val, 0);
  const totalNotes = notesData.reduce((sum, val) => sum + val, 0);
  const totalMCQs = mcqsData.reduce((sum, val) => sum + val, 0);

  return (
    <div className="bg-card rounded-2xl overflow-hidden h-full flex flex-col" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h3 style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)', fontWeight: 600, color: 'white' }}>Content Statistics</h3>
        <p style={{ fontSize: 'clamp(0.7rem, 1.1vw, 0.8rem)', color: 'rgba(156,163,175,1)', marginTop: '2px' }}>By subject area</p>
      </div>
      <div className="flex-1 px-5 pb-2" style={{ minHeight: '180px' }}>
        <Bar data={data} options={options} />
      </div>
      <div className="px-5 pb-5 pt-3 border-t border-background-800 grid grid-cols-3 gap-3 flex-shrink-0">
        {[
          { label: 'Lessons', value: totalLessons, color: '#6366f1' },
          { label: 'Notes',   value: totalNotes,   color: '#8b5cf6' },
          { label: 'MCQs',    value: totalMCQs,    color: '#10b981' },
        ].map(item => (
          <div key={item.label} className="text-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1.5" style={{ background: item.color }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'white' }}>{item.label[0]}</span>
            </div>
            <p style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.1rem)', fontWeight: 700, color: 'white' }}>{item.value}</p>
            <p style={{ fontSize: 'clamp(0.6rem, 0.9vw, 0.7rem)', color: 'rgba(156,163,175,1)' }}>{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentStatsChart;
